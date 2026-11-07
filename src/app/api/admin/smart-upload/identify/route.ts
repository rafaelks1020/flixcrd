import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminDenied } from "@/lib/require-admin";
import { claudeConfigured, claudeJson, ClaudeRefusalError } from "@/lib/ai/claude";

const MAX_FILES = 300;
const BATCH_SIZE = 60;
const MAX_CANDIDATES = 3;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_CONCURRENCY = 6;

const BodySchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(500),
        relativePath: z.string().max(1000).optional(),
        size: z.number().optional(),
      }),
    )
    .min(1)
    .max(MAX_FILES),
});

const IdentifySchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int(),
      kind: z.enum(["MOVIE", "EPISODE", "UNKNOWN"]),
      title: z.string(),
      originalTitle: z.string().nullable(),
      year: z.number().int().nullable(),
      season: z.number().int().nullable(),
      episode: z.number().int().nullable(),
      confidence: z.number().int(),
    }),
  ),
});

type IdentifiedItem = z.infer<typeof IdentifySchema>["items"][number];

const SYSTEM = `Você identifica filmes e episódios de séries/anime a partir de caminhos de arquivos (pasta + nome do arquivo).
Cada linha da entrada tem o formato: <índice>: <caminho>. Devolva um item para cada índice recebido.
Regras:
- A pasta ajuda: "Breaking Bad/Season 2/ep05.mkv" é a série Breaking Bad, temporada 2, episódio 5.
- Limpe o ruído do nome: resolução (1080p, 720p, 4K), codecs (x264, x265, HEVC), fonte (BluRay, WEB-DL, WEBRip, HDTV), grupo de release, [tags] e (tags), idioma (Dual Audio, Dublado, Legendado).
- kind "MOVIE" para filme, "EPISODE" para episódio de série ou anime, "UNKNOWN" quando não der para saber.
- title é o nome limpo da obra (para episódio, o nome da SÉRIE, nunca o título do episódio). originalTitle só se aparecer claramente no nome, senão null.
- year é o ano de lançamento quando aparece no nome ou na pasta, senão null. Ano não é número de episódio.
- Anime com numeração absoluta ("Naruto - 142") vira season 1, episode 142.
- Algarismo romano no nome da série indica a temporada ("Overlord II - 08" = season 2, episode 8).
- Sem temporada explícita em episódio, use season 1. Para filme, season e episode são null.
- Legendas (.srt, .vtt, .ass), imagens, textos e qualquer arquivo que não seja vídeo são "UNKNOWN".
- confidence de 0 a 100: sua certeza na identificação (nome claro e completo: acima de 85; palpite: abaixo de 50).
- Mantenha o mesmo título para todos os arquivos da mesma obra (mesma grafia).`;

const VIDEO_EXT = /\.(mp4|mkv|avi|mov|m4v|webm|ts)$/i;

interface Candidate {
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  posterUrl: string | null;
  overview: string;
  existingTitleId: string | null;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function runPool<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

async function searchTmdb(
  apiKey: string,
  kind: "MOVIE" | "SERIES",
  title: string,
  year: number | null,
): Promise<Candidate[]> {
  const endpoint = kind === "MOVIE" ? "movie" : "tv";

  async function run(withYear: boolean): Promise<any[]> {
    const url = new URL(`${TMDB_BASE_URL}/search/${endpoint}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("query", title);
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("page", "1");
    if (withYear && year) {
      url.searchParams.set(kind === "MOVIE" ? "year" : "first_air_date_year", String(year));
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  }

  let results = await run(true);
  if (results.length === 0 && year) {
    results = await run(false);
  }

  return results.slice(0, MAX_CANDIDATES).map((item: any) => {
    const date: string | null = (kind === "MOVIE" ? item.release_date : item.first_air_date) || null;
    const parsedYear = date ? parseInt(date.slice(0, 4), 10) : NaN;
    const overview = typeof item.overview === "string" ? item.overview : "";
    return {
      tmdbId: item.id as number,
      name: (item.title ?? item.name ?? "") as string,
      originalName: (item.original_title ?? item.original_name ?? null) as string | null,
      year: Number.isNaN(parsedYear) ? null : parsedYear,
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null,
      overview: overview.length > 180 ? `${overview.slice(0, 177).trimEnd()}...` : overview,
      existingTitleId: null,
    };
  });
}

interface GroupDraft {
  key: string;
  kind: "MOVIE" | "SERIES";
  title: string;
  year: number | null;
  years: number[];
  files: Array<{
    index: number;
    name: string;
    season: number | null;
    episode: number | null;
    confidence: number;
  }>;
}

/**
 * POST /api/admin/smart-upload/identify
 * Body: { files: [{ name, relativePath?, size? }] } (máx. 300)
 * Identifica filmes/episódios com o Claude, agrupa e sugere candidatos do TMDB.
 */
export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;

  const raw = await request.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(raw);
  if (!parsedBody.success) {
    const tooMany = Array.isArray(raw?.files) && raw.files.length > MAX_FILES;
    return NextResponse.json(
      {
        error: tooMany
          ? `Máximo de ${MAX_FILES} arquivos por vez.`
          : "Corpo inválido: envie files com name (até 500 caracteres) em cada item.",
      },
      { status: 400 },
    );
  }
  const files = parsedBody.data.files;

  if (!claudeConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, { status: 503 });
  }

  try {
    // 1) Identificação por IA, em lotes. Arquivos que claramente não são vídeo já viram UNKNOWN.
    const identified = new Map<number, IdentifiedItem>();
    const candidatesForAi: number[] = [];
    files.forEach((f, i) => {
      if (VIDEO_EXT.test(f.name)) candidatesForAi.push(i);
    });

    const batches = chunk(candidatesForAi, BATCH_SIZE);
    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        const lines = batch
          .map((i) => `${i}: ${JSON.stringify(files[i].relativePath?.trim() || files[i].name)}`)
          .join("\n");
        const result = await claudeJson({
          schema: IdentifySchema,
          system: SYSTEM,
          user: `Identifique os ${batch.length} arquivos abaixo:\n${lines}`,
          maxTokens: 8000,
        });
        return { batch, items: result.items };
      }),
    );

    for (const { batch, items } of batchResults) {
      const allowed = new Set(batch);
      for (const item of items) {
        if (allowed.has(item.index) && !identified.has(item.index)) {
          identified.set(item.index, item);
        }
      }
    }

    // 2) Agrupamento
    const drafts = new Map<string, GroupDraft>();
    const unknown: Array<{ index: number; name: string }> = [];

    files.forEach((f, i) => {
      const item = identified.get(i);
      const title = item?.title?.trim() ?? "";
      if (!item || item.kind === "UNKNOWN" || !title) {
        unknown.push({ index: i, name: f.name });
        return;
      }

      const isMovie = item.kind === "MOVIE";
      const normTitle = normalizeKey(title);
      if (!normTitle) {
        unknown.push({ index: i, name: f.name });
        return;
      }

      const key = isMovie ? `movie:${normTitle}:${item.year ?? ""}` : `tv:${normTitle}`;
      let draft = drafts.get(key);
      if (!draft) {
        draft = {
          key,
          kind: isMovie ? "MOVIE" : "SERIES",
          title,
          year: null,
          years: [],
          files: [],
        };
        drafts.set(key, draft);
      }
      if (item.year) draft.years.push(item.year);

      draft.files.push({
        index: i,
        name: f.name,
        season: isMovie ? null : item.episode !== null ? (item.season ?? 1) : item.season,
        episode: isMovie ? null : item.episode,
        confidence: clamp(item.confidence, 0, 100),
      });
    });

    const groupList = Array.from(drafts.values());
    for (const g of groupList) {
      if (g.years.length > 0) {
        const counts = new Map<number, number>();
        for (const y of g.years) counts.set(y, (counts.get(y) ?? 0) + 1);
        g.year = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      }
    }

    // 3) TMDB (candidatos por grupo)
    const apiKey = process.env.TMDB_API_KEY?.trim();
    let warning: string | undefined;
    let candidatesByGroup: Candidate[][];

    if (!apiKey) {
      warning = "TMDB_API_KEY não configurada: sem sugestões do TMDB. Use a busca manual.";
      candidatesByGroup = groupList.map(() => []);
    } else {
      let tmdbFailures = 0;
      candidatesByGroup = await runPool(
        groupList.map((g) => async () => {
          try {
            return await searchTmdb(apiKey, g.kind, g.title, g.year);
          } catch (err) {
            tmdbFailures += 1;
            console.error("smart-upload identify: TMDB search error", err);
            return [] as Candidate[];
          }
        }),
        TMDB_CONCURRENCY,
      );
      if (tmdbFailures > 0) {
        warning = `Falha ao consultar o TMDB em ${tmdbFailures} grupo(s). Use a busca manual neles.`;
      }
    }

    // 4) Títulos já existentes no banco
    const tmdbIds = Array.from(new Set(candidatesByGroup.flat().map((c) => c.tmdbId)));
    const existing =
      tmdbIds.length > 0
        ? await prisma.title.findMany({
            where: { tmdbId: { in: tmdbIds } },
            select: { id: true, tmdbId: true },
          })
        : [];
    const existingByTmdb = new Map<number, string>();
    for (const t of existing) {
      if (t.tmdbId !== null) existingByTmdb.set(t.tmdbId, t.id);
    }

    const groups = groupList.map((g, gi) => {
      const candidates = candidatesByGroup[gi].map((c) => ({
        ...c,
        existingTitleId: existingByTmdb.get(c.tmdbId) ?? null,
      }));
      const selected = candidates[0] ?? null;
      return {
        key: g.key,
        kind: g.kind,
        title: g.title,
        year: g.year,
        candidates,
        selectedTmdbId: selected?.tmdbId ?? null,
        existingTitleId: selected?.existingTitleId ?? null,
        files: g.files.sort((a, b) =>
          a.season !== b.season
            ? (a.season ?? 0) - (b.season ?? 0)
            : (a.episode ?? 0) - (b.episode ?? 0) || a.index - b.index,
        ),
      };
    });

    return NextResponse.json({ groups, unknown, ...(warning ? { warning } : {}) });
  } catch (error) {
    console.error("POST /api/admin/smart-upload/identify error:", error);
    if (error instanceof ClaudeRefusalError) {
      return NextResponse.json({ error: "A IA recusou a solicitação." }, { status: 502 });
    }
    return NextResponse.json({ error: "Erro ao identificar arquivos" }, { status: 500 });
  }
}
