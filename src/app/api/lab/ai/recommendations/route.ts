import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/app-settings";
import { isExplicitContent } from "@/lib/content-filter";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

import { getAvailableTmdbIds } from "@/lib/superflix";

export const dynamic = "force-dynamic";

const rateWindowMs = 60 * 1000;
const rateLimitMax = 12;
const rateBuckets = new Map<string, number[]>();

function getMonthStartUtc(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function fetchSeedSignals(seed: Seed): Promise<SeedSignals> {
  const base = `${TMDB_API}/${seed.mediaType}/${seed.id}`;

  const detailsUrl = `${base}?api_key=${TMDB_KEY}&language=pt-BR`;
  const keywordsUrl = `${base}/keywords?api_key=${TMDB_KEY}`;
  const creditsUrl = `${base}/credits?api_key=${TMDB_KEY}&language=pt-BR`;

  const [detailsRes, keywordsRes, creditsRes] = await Promise.allSettled([
    fetch(detailsUrl, { next: { revalidate: 300 } }),
    fetch(keywordsUrl, { next: { revalidate: 300 } }),
    fetch(creditsUrl, { next: { revalidate: 300 } }),
  ]);

  const detailsJson =
    detailsRes.status === "fulfilled" && detailsRes.value.ok ? await detailsRes.value.json().catch(() => null) : null;
  const keywordsJson =
    keywordsRes.status === "fulfilled" && keywordsRes.value.ok ? await keywordsRes.value.json().catch(() => null) : null;
  const creditsJson =
    creditsRes.status === "fulfilled" && creditsRes.value.ok ? await creditsRes.value.json().catch(() => null) : null;

  const originalLanguage =
    detailsJson && typeof detailsJson.original_language === "string" ? String(detailsJson.original_language) : null;

  const keywordItems =
    seed.mediaType === "movie"
      ? Array.isArray(keywordsJson?.keywords)
        ? keywordsJson.keywords
        : []
      : Array.isArray(keywordsJson?.results)
        ? keywordsJson.results
        : [];
  const keywordIds = uniqueInts(
    keywordItems.map((k: any) => parseInt(String(k?.id ?? ""), 10)).filter((n: number) => Number.isFinite(n)),
    10
  );

  const castItems = Array.isArray(creditsJson?.cast) ? creditsJson.cast : [];
  const castIds = uniqueInts(
    castItems
      .slice(0, 8)
      .map((c: any) => parseInt(String(c?.id ?? ""), 10))
      .filter((n: number) => Number.isFinite(n)),
    6
  );

  const genreIds = uniqueInts(
    Array.isArray(detailsJson?.genres)
      ? (detailsJson.genres
        .map((g: any) => parseInt(String(g?.id ?? ""), 10))
        .filter((n: number) => Number.isFinite(n)) as number[])
      : [],
    8
  );

  return {
    mediaType: seed.mediaType,
    seedId: seed.id,
    originalLanguage,
    keywordIds,
    castIds,
    genreIds,
  };
}

function getNextMonthStartUtc(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function clampInt(value: any, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(input: string): any | null {
  const trimmed = (input || "").trim();

  const withoutFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    // ignore
  }

  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = withoutFences.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  return null;
}

function isAvailable(available: Set<number>, mediaType: "movie" | "tv", tmdbId: number) {
  return available.has(tmdbId);
}

type Seed = { mediaType: "movie" | "tv"; id: number; name?: string };

type AiParsed = {
  seeds?: string[];
  mediaPreference?: "movie" | "tv" | "both";
  movieGenreIds?: number[];
  tvGenreIds?: number[];
  excludeMovieGenreIds?: number[];
  excludeTvGenreIds?: number[];
  minYear?: number | null;
  maxYear?: number | null;
};

interface TmdbItem {
  id: number;
  title?: string;
  name?: string;
  original_language?: string;
  origin_country?: string[];
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  release_date?: string;
  first_air_date?: string;
  adult?: boolean;
}

type SeedSignals = {
  mediaType: "movie" | "tv";
  seedId: number;
  originalLanguage: string | null;
  keywordIds: number[];
  castIds: number[];
  genreIds: number[];
};

function parseYearFromDate(input?: string | null) {
  if (!input) return null;
  const y = parseInt(String(input).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function hasAnyGenre(genreIds: number[], targets: number[]) {
  if (!genreIds.length || !targets.length) return false;
  for (const t of targets) if (genreIds.includes(t)) return true;
  return false;
}

function countGenreMatches(genreIds: number[], targets: number[]) {
  if (!genreIds.length || !targets.length) return 0;
  let c = 0;
  for (const t of targets) if (genreIds.includes(t)) c++;
  return c;
}

function uniqueInts(input: number[], max: number) {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const raw of input) {
    const n = parseInt(String(raw), 10);
    if (!Number.isFinite(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

function mostCommonString(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) continue;
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, c] of counts.entries()) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}

function scoreCandidate(params: {
  item: TmdbItem;
  mediaType: "movie" | "tv";
  sourceWeight: number;
  desiredGenres: number[];
  excludedGenres: number[];
  minYear: number | null;
  maxYear: number | null;
  preferredOriginalLanguage?: string | null;
}) {
  const { item, desiredGenres, excludedGenres } = params;
  const genres = Array.isArray(item.genre_ids)
    ? item.genre_ids.map((n) => parseInt(String(n), 10)).filter((n) => Number.isFinite(n))
    : [];

  if (excludedGenres.length && hasAnyGenre(genres, excludedGenres)) {
    return null;
  }

  let score = params.sourceWeight;

  const matchCount = countGenreMatches(genres, desiredGenres);
  if (desiredGenres.length > 0) {
    score += matchCount * 9;
    if (matchCount === 0) score -= 6;
  }

  const year = parseYearFromDate(item.release_date || item.first_air_date);
  if (params.minYear && year && year < params.minYear) score -= 20;
  if (params.maxYear && year && year > params.maxYear) score -= 20;

  const lang = typeof item.original_language === "string" ? item.original_language : "";
  const prefLang = typeof params.preferredOriginalLanguage === "string" ? params.preferredOriginalLanguage : "";
  if (prefLang && lang) {
    if (lang === prefLang) score += 14;
    else score -= 4;
  }

  const voteAvg = typeof item.vote_average === "number" ? item.vote_average : 0;
  const pop = typeof item.popularity === "number" ? item.popularity : 0;
  const votes = typeof item.vote_count === "number" ? item.vote_count : 0;

  score += voteAvg * 1.4;
  score += Math.min(2.5, votes / 800);
  score += pop * 0.02;

  return { score, genres };
}

function normalizeIntArray(input: any, max: number) {
  if (!Array.isArray(input)) return [] as number[];
  return input
    .map((n) => parseInt(String(n), 10))
    .filter((n) => Number.isFinite(n))
    .slice(0, max);
}

function applyRateLimit(key: string) {
  const now = Date.now();
  const existing = rateBuckets.get(key) || [];
  const pruned = existing.filter((t) => now - t < rateWindowMs);
  if (pruned.length >= rateLimitMax) {
    rateBuckets.set(key, pruned);
    return false;
  }
  pruned.push(now);
  rateBuckets.set(key, pruned);
  return true;
}

async function callClaudeHaiku(text: string) {
  const apiKey = process.env.CLAUDE_KEY;
  if (!apiKey) {
    return { ok: false as const, error: "CLAUDE_KEY não configurada." };
  }

  const model = (process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001").trim();

  const system = `Você é um assistente especializado em recomendações de filmes e séries. Sua tarefa é analisar o pedido do usuário e extrair informações estruturadas.

RESPONDA APENAS COM JSON VÁLIDO (sem markdown, sem \`\`\`json, sem explicações):
{
  "seeds": string[],
  "mediaPreference": "movie" | "tv" | "both",
  "movieGenreIds": number[],
  "tvGenreIds": number[],
  "excludeMovieGenreIds": number[],
  "excludeTvGenreIds": number[],
  "minYear": number | null,
  "maxYear": number | null
}

REGRAS CRÍTICAS:
1. seeds: Títulos mencionados pelo usuário. IMPORTANTE: Se o usuário mencionar um nome que parece ser um título (como "Vincenzo", "Squid Game", "Crash Landing on You", "Goblin"), adicione ao seeds mesmo que tenha erros de digitação. Corrija erros óbvios (ex: "Vicenzo" → "Vincenzo"). Máximo 5.
2. DORAMA/K-DRAMA: Se o usuário mencionar "dorama", "kdrama", "k-drama" ou "coreano", use mediaPreference="tv" e adicione o nome mencionado aos seeds.
3. NÃO invente títulos extras. Apenas corrija erros de digitação do que o usuário escreveu.
4. mediaPreference: "movie" se pedir filme/cinema, "tv" se pedir série/anime/dorama/episódio, "both" se genérico.
5. Use APENAS estes IDs de gênero TMDB:

FILMES: Ação=28, Aventura=12, Animação=16, Comédia=35, Crime=80, Documentário=99, Drama=18, Família=10751, Fantasia=14, História=36, Terror=27, Música=10402, Mistério=9648, Romance=10749, Ficção científica=878, Thriller=53, Guerra=10752, Faroeste=37

SÉRIES: Ação e Aventura=10759, Animação=16, Comédia=35, Crime=80, Documentário=99, Drama=18, Família=10751, Kids=10762, Mistério=9648, News=10763, Reality=10764, Ficção e Fantasia=10765, Soap=10766, Talk=10767, War & Politics=10768, Faroeste=37

6. excludeMovieGenreIds/excludeTvGenreIds: use quando o usuário disser "sem terror", "não quero comédia", etc.
7. minYear/maxYear: extraia se o usuário mencionar década/ano (ex: "anos 90" = minYear:1990, maxYear:1999).
8. Se não tiver certeza sobre algo, deixe vazio ou null.

EXEMPLOS:

Usuário: "filmes de ação como John Wick"
Resposta: {"seeds":["John Wick"],"mediaPreference":"movie","movieGenreIds":[28],"tvGenreIds":[],"excludeMovieGenreIds":[],"excludeTvGenreIds":[],"minYear":null,"maxYear":null}

Usuário: "séries de drama e mistério"
Resposta: {"seeds":[],"mediaPreference":"tv","movieGenreIds":[],"tvGenreIds":[18,9648],"excludeMovieGenreIds":[],"excludeTvGenreIds":[],"minYear":null,"maxYear":null}

Usuário: "algo parecido com Stranger Things mas sem terror"
Resposta: {"seeds":["Stranger Things"],"mediaPreference":"tv","movieGenreIds":[],"tvGenreIds":[10765],"excludeMovieGenreIds":[],"excludeTvGenreIds":[27],"minYear":null,"maxYear":null}

Usuário: "Vicenzo dorama"
Resposta: {"seeds":["Vincenzo"],"mediaPreference":"tv","movieGenreIds":[],"tvGenreIds":[18,80],"excludeMovieGenreIds":[],"excludeTvGenreIds":[],"minYear":null,"maxYear":null}

Usuário: "séries coreanas como Squid Game"
Resposta: {"seeds":["Squid Game"],"mediaPreference":"tv","movieGenreIds":[],"tvGenreIds":[18],"excludeMovieGenreIds":[],"excludeTvGenreIds":[],"minYear":null,"maxYear":null}

RESPONDA APENAS O JSON, NADA MAIS.`;

  const upstreamRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.1,
      system,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text }],
        },
      ],
    }),
  });

  const json = await upstreamRes.json().catch(() => null);

  if (!upstreamRes.ok) {
    const message =
      json?.error?.message ||
      json?.message ||
      json?.error ||
      "Falha ao chamar Anthropic";
    return { ok: false as const, error: String(message), model };
  }

  const content0 = json?.content?.[0];
  const contentText =
    typeof content0?.text === "string"
      ? content0.text
      : typeof json?.content === "string"
        ? json.content
        : "";

  return { ok: true as const, contentText, model };
}

function normalizeLoose(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveSeedsFromTitles(
  titles: string[],
  limit: number,
  allowedMediaTypes: Set<"movie" | "tv">,
  includeAdult: boolean
): Promise<Seed[]> {
  const out: Seed[] = [];
  const seen = new Set<string>();

  for (const raw of titles) {
    const q = String(raw || "").trim();
    if (!q) continue;

    const url = `${TMDB_API}/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(q)}&page=1&include_adult=${includeAdult}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) continue;
    const json = await res.json().catch(() => null);
    const items = Array.isArray(json?.results) ? json.results : [];

    const qn = normalizeLoose(q);
    const candidates = items
      .filter((it: any) => it?.media_type === "movie" || it?.media_type === "tv")
      .filter((it: any) => allowedMediaTypes.has(it.media_type === "movie" ? "movie" : "tv"));

    const best = candidates
      .map((it: any) => {
        const name = typeof it?.title === "string" ? it.title : typeof it?.name === "string" ? it.name : "";
        const nn = normalizeLoose(name);
        let score = typeof it?.popularity === "number" ? it.popularity : 0;
        if (nn === qn) score += 2000;
        else if (nn.startsWith(qn)) score += 1400;
        else if (nn.includes(qn)) score += 900;
        return { it, score };
      })
      .sort((a: any, b: any) => b.score - a.score)[0]?.it;
    if (!best) continue;

    const mediaType = best.media_type === "movie" ? "movie" : "tv";
    const id = typeof best.id === "number" ? best.id : parseInt(String(best.id || ""), 10);
    if (!Number.isFinite(id)) continue;

    const key = `${mediaType}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ mediaType, id, name: q });
    if (out.length >= limit) break;
  }

  return out;
}

async function fetchTmdbRecommendations(seed: Seed, page?: number): Promise<TmdbItem[]> {
  const p = clampInt(page, 1, 1, 10);
  const url = `${TMDB_API}/${seed.mediaType}/${seed.id}/recommendations?api_key=${TMDB_KEY}&language=pt-BR&page=${p}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return Array.isArray(json?.results) ? (json.results as TmdbItem[]) : [];
}

async function fetchTmdbDiscover(params: {
  mediaType: "movie" | "tv";
  withGenres: number[];
  withoutGenres: number[];
  withKeywords?: number[];
  withCast?: number[];
  withOriginalLanguage?: string | null;
  minYear?: number | null;
  maxYear?: number | null;
  page?: number;
  includeAdult?: boolean;
}): Promise<TmdbItem[]> {
  const page = clampInt(params.page, 1, 1, 10);
  const withGenres = params.withGenres.filter((n) => Number.isFinite(n)).slice(0, 8);
  const withoutGenres = params.withoutGenres.filter((n) => Number.isFinite(n)).slice(0, 8);
  const withKeywords = Array.isArray(params.withKeywords)
    ? params.withKeywords.filter((n) => Number.isFinite(n)).slice(0, 10)
    : [];
  const withCast = Array.isArray(params.withCast) ? params.withCast.filter((n) => Number.isFinite(n)).slice(0, 6) : [];
  const withOriginalLanguage =
    typeof params.withOriginalLanguage === "string" && params.withOriginalLanguage.trim()
      ? params.withOriginalLanguage.trim()
      : "";

  const qp = new URLSearchParams();
  qp.set("api_key", TMDB_KEY);
  qp.set("language", "pt-BR");
  qp.set("sort_by", "popularity.desc");
  qp.set("include_adult", String(!!params.includeAdult));
  qp.set("page", String(page));

  if (withGenres.length) qp.set("with_genres", withGenres.join("|"));
  if (withoutGenres.length) qp.set("without_genres", withoutGenres.join("|"));
  if (withKeywords.length) qp.set("with_keywords", withKeywords.join("|"));
  if (withOriginalLanguage) qp.set("with_original_language", withOriginalLanguage);
  if (withCast.length) qp.set("with_cast", withCast.join("|"));

  if (params.mediaType === "movie") {
    if (params.minYear) qp.set("primary_release_date.gte", `${params.minYear}-01-01`);
    if (params.maxYear) qp.set("primary_release_date.lte", `${params.maxYear}-12-31`);
  } else {
    if (params.minYear) qp.set("first_air_date.gte", `${params.minYear}-01-01`);
    if (params.maxYear) qp.set("first_air_date.lte", `${params.maxYear}-12-31`);
  }

  const url = `${TMDB_API}/discover/${params.mediaType}?${qp.toString()}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    if (withCast.length && params.mediaType === "tv") {
      qp.delete("with_cast");
      const retryUrl = `${TMDB_API}/discover/${params.mediaType}?${qp.toString()}`;
      const retryRes = await fetch(retryUrl, { next: { revalidate: 300 } });
      if (!retryRes.ok) return [];
      const retryJson = await retryRes.json().catch(() => null);
      return Array.isArray(retryJson?.results) ? (retryJson.results as TmdbItem[]) : [];
    }
    return [];
  }
  const json = await res.json().catch(() => null);
  return Array.isArray(json?.results) ? (json.results as TmdbItem[]) : [];
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!TMDB_KEY) {
      return NextResponse.json({ error: "TMDB_API_KEY não configurada." }, { status: 500 });
    }

    if (user.role !== "ADMIN") {
      const now = new Date();
      const monthStart = getMonthStartUtc(now);
      const nextAllowedAt = getNextMonthStartUtc(now);

      try {
        const ai = (prisma as any).aiLabRecommendation as any;
        const already = await ai.findFirst({
          where: {
            userId: user.id,
            createdAt: {
              gte: monthStart,
            },
          },
          select: { id: true, createdAt: true },
        });

        if (already?.id) {
          return NextResponse.json(
            {
              error: "Você já gerou recomendações este mês. Tente novamente no próximo mês.",
              nextAllowedAt: nextAllowedAt.toISOString(),
            },
            { status: 429 }
          );
        }
      } catch (e) {
        console.warn("Monthly AI limit check failed", e);
      }
    }

    if (!applyRateLimit(user.id)) {
      return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const limit = clampInt(body?.limit, 24, 6, 48);

    if (!text || text.length < 6) {
      return NextResponse.json({ error: "Envie um texto maior para a IA entender seu gosto." }, { status: 400 });
    }

    if (text.length > 800) {
      return NextResponse.json({ error: "Texto muito grande." }, { status: 400 });
    }

    const claude = await callClaudeHaiku(text);

    if (!claude.ok) {
      return NextResponse.json({ error: claude.error }, { status: 502 });
    }

    const parsedRaw = safeJsonParse(claude.contentText);
    const parsed: AiParsed = parsedRaw && typeof parsedRaw === "object" ? parsedRaw : {};

    // Validação rigorosa do mediaPreference
    const mediaPreference: "movie" | "tv" | "both" =
      parsed.mediaPreference === "movie" || parsed.mediaPreference === "tv" || parsed.mediaPreference === "both"
        ? parsed.mediaPreference
        : "both";

    const allowedMediaTypes =
      mediaPreference === "movie"
        ? new Set<"movie" | "tv">(["movie"])
        : mediaPreference === "tv"
          ? new Set<"movie" | "tv">(["tv"])
          : new Set<"movie" | "tv">(["movie", "tv"]);

    // Validação rigorosa dos seeds - apenas strings não vazias
    const seedTitles = Array.isArray(parsed.seeds)
      ? parsed.seeds
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 5)
      : [];

    // Validação de IDs de gênero - apenas números válidos do TMDB
    const validMovieGenres = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37];
    const validTvGenres = [10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10763, 10764, 10765, 10766, 10767, 10768, 37];

    const movieGenreIds = normalizeIntArray(parsed.movieGenreIds, 8).filter(id => validMovieGenres.includes(id));
    const tvGenreIds = normalizeIntArray(parsed.tvGenreIds, 8).filter(id => validTvGenres.includes(id));
    const excludeMovieGenreIds = normalizeIntArray(parsed.excludeMovieGenreIds, 8).filter(id => validMovieGenres.includes(id));
    const excludeTvGenreIds = normalizeIntArray(parsed.excludeTvGenreIds, 8).filter(id => validTvGenres.includes(id));

    // Validação de anos
    const currentYear = new Date().getFullYear();
    let minYear = typeof parsed.minYear === "number" && parsed.minYear >= 1900 && parsed.minYear <= currentYear + 2 ? parsed.minYear : null;
    let maxYear = typeof parsed.maxYear === "number" && parsed.maxYear >= 1900 && parsed.maxYear <= currentYear + 2 ? parsed.maxYear : null;

    // Garantir que minYear <= maxYear
    if (minYear && maxYear && minYear > maxYear) {
      [minYear, maxYear] = [maxYear, minYear];
    }

    const settings = await getAppSettings();
    const hideAdult = settings.hideAdultContent;

    const seeds = await resolveSeedsFromTitles(seedTitles, 4, allowedMediaTypes, !hideAdult);

    // Fallback: se não encontrou seeds e não tem gêneros, usar trending
    if (seeds.length === 0 && movieGenreIds.length === 0 && tvGenreIds.length === 0) {
      console.log("[AI Recommendations] Nenhum seed ou gênero encontrado, usando fallback para trending");
    }

    const seedSignals = await Promise.all(seeds.map((s) => fetchSeedSignals(s)));

    const preferredMovieLang = mostCommonString(seedSignals.filter((s) => s.mediaType === "movie").map((s) => s.originalLanguage));
    const preferredTvLang = mostCommonString(seedSignals.filter((s) => s.mediaType === "tv").map((s) => s.originalLanguage));

    const seedMovieKeywords = uniqueInts(
      seedSignals.filter((s) => s.mediaType === "movie").flatMap((s) => s.keywordIds),
      10
    );
    const seedTvKeywords = uniqueInts(
      seedSignals.filter((s) => s.mediaType === "tv").flatMap((s) => s.keywordIds),
      10
    );

    const seedMovieCast = uniqueInts(seedSignals.filter((s) => s.mediaType === "movie").flatMap((s) => s.castIds), 6);
    const seedTvCast = uniqueInts(seedSignals.filter((s) => s.mediaType === "tv").flatMap((s) => s.castIds), 6);

    const seedMovieGenres = uniqueInts(seedSignals.filter((s) => s.mediaType === "movie").flatMap((s) => s.genreIds), 8);
    const seedTvGenres = uniqueInts(seedSignals.filter((s) => s.mediaType === "tv").flatMap((s) => s.genreIds), 8);

    const desiredMovieGenres = movieGenreIds.length ? movieGenreIds : seedMovieGenres;
    const desiredTvGenres = tvGenreIds.length ? tvGenreIds : seedTvGenres;

    const availableIds = await getAvailableTmdbIds();

    const candidateLimit = Math.max(limit, Math.min(240, limit * 6));
    const out: any[] = [];
    const seen = new Set<string>();

    for (const seed of seeds) {
      if (!allowedMediaTypes.has(seed.mediaType)) continue;
      for (let page = 1; page <= 3 && out.length < candidateLimit; page++) {
        const recItems = await fetchTmdbRecommendations(seed, page);

        for (const item of recItems) {
          if (typeof item?.id !== "number") continue;
          if (hideAdult) {
            if (item.adult) continue;
            if (isExplicitContent({
              name: item.title || item.name || "",
              overview: item.overview || "",
              adult: item.adult
            })) continue;
          }
          if (!isAvailable(availableIds, seed.mediaType, item.id)) continue;

          const desiredGenres = seed.mediaType === "movie" ? desiredMovieGenres : desiredTvGenres;
          const excludedGenres = seed.mediaType === "movie" ? excludeMovieGenreIds : excludeTvGenreIds;
          const scored = scoreCandidate({
            item,
            mediaType: seed.mediaType,
            sourceWeight: 70,
            desiredGenres,
            excludedGenres,
            minYear,
            maxYear,
            preferredOriginalLanguage: seed.mediaType === "movie" ? preferredMovieLang : preferredTvLang,
          });
          if (!scored) continue;

          const type = seed.mediaType === "movie" ? "MOVIE" : "SERIES";
          const key = `${type}-${item.id}`;
          if (seen.has(key)) continue;
          seen.add(key);

          out.push({
            id: `lab-ai-${seed.mediaType}-${item.id}`,
            tmdbId: item.id,
            name: item.title || item.name || "Sem título",
            posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
            overview: item.overview || "",
            voteAverage: typeof item.vote_average === "number" ? item.vote_average : 0,
            releaseDate: item.release_date || item.first_air_date || null,
            type,
            _score: scored.score,
          });

          if (out.length >= candidateLimit) break;
        }

        if (out.length >= candidateLimit) break;
      }

      if (out.length >= candidateLimit) break;
    }

    if (out.length < candidateLimit) {
      const discoverResults: Array<{ mediaType: "movie" | "tv"; item: TmdbItem }> = [];

      if (
        (desiredMovieGenres.length || excludeMovieGenreIds.length || !seeds.length || seedMovieKeywords.length || seedMovieCast.length) &&
        allowedMediaTypes.has("movie")
      ) {
        for (let page = 1; page <= 3 && discoverResults.length < candidateLimit; page++) {
          const items = await fetchTmdbDiscover({
            mediaType: "movie",
            withGenres: desiredMovieGenres,
            withoutGenres: excludeMovieGenreIds,
            withKeywords: seedMovieKeywords,
            withCast: seedMovieCast,
            withOriginalLanguage: preferredMovieLang,
            minYear,
            maxYear,
            page,
            includeAdult: !hideAdult,
          });
          discoverResults.push(...items.map((item) => ({ mediaType: "movie" as const, item })));
        }
      }

      if (
        (desiredTvGenres.length || excludeTvGenreIds.length || !seeds.length || seedTvKeywords.length || seedTvCast.length || preferredTvLang) &&
        allowedMediaTypes.has("tv")
      ) {
        for (let page = 1; page <= 3 && discoverResults.length < candidateLimit; page++) {
          const items = await fetchTmdbDiscover({
            mediaType: "tv",
            withGenres: desiredTvGenres,
            withoutGenres: excludeTvGenreIds,
            withKeywords: seedTvKeywords,
            withCast: seedTvCast,
            withOriginalLanguage: preferredTvLang,
            minYear,
            maxYear,
            page,
            includeAdult: !hideAdult,
          });
          discoverResults.push(...items.map((item) => ({ mediaType: "tv" as const, item })));
        }
      }

      for (const row of discoverResults) {
        const item = row.item;
        if (typeof item?.id !== "number") continue;
        if (!isAvailable(availableIds, row.mediaType, item.id)) continue;

        if (hideAdult && isExplicitContent({
          name: item.title || item.name || "",
          overview: item.overview || "",
          adult: item.adult
        })) continue;

        const desiredGenres = row.mediaType === "movie" ? desiredMovieGenres : desiredTvGenres;
        const excludedGenres = row.mediaType === "movie" ? excludeMovieGenreIds : excludeTvGenreIds;
        const scored = scoreCandidate({
          item,
          mediaType: row.mediaType,
          sourceWeight: 45,
          desiredGenres,
          excludedGenres,
          minYear,
          maxYear,
          preferredOriginalLanguage: row.mediaType === "movie" ? preferredMovieLang : preferredTvLang,
        });
        if (!scored) continue;

        const type = row.mediaType === "movie" ? "MOVIE" : "SERIES";
        const key = `${type}-${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          id: `lab-ai-discover-${row.mediaType}-${item.id}`,
          tmdbId: item.id,
          name: item.title || item.name || "Sem título",
          posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
          overview: item.overview || "",
          voteAverage: typeof item.vote_average === "number" ? item.vote_average : 0,
          releaseDate: item.release_date || item.first_air_date || null,
          type,
          _score: scored.score,
        });

        if (out.length >= candidateLimit) break;
      }
    }

    out.sort((a: any, b: any) => {
      const as = typeof a?._score === "number" ? a._score : 0;
      const bs = typeof b?._score === "number" ? b._score : 0;
      if (bs !== as) return bs - as;
      const av = typeof a?.voteAverage === "number" ? a.voteAverage : 0;
      const bv = typeof b?.voteAverage === "number" ? b.voteAverage : 0;
      return bv - av;
    });

    const publicResults = out.slice(0, limit).map(({ _score, ...rest }: any) => rest);

    try {
      const top3 = publicResults.slice(0, 3);

      await prisma.$transaction(async (tx) => {
        const ai = (tx as any).aiLabRecommendation as any;

        await ai.create({
          data: {
            userId: user.id,
            queryText: text,
            model: claude.model,
            parsed: {
              seeds: seedTitles,
              mediaPreference,
              movieGenreIds,
              tvGenreIds,
              excludeMovieGenreIds,
              excludeTvGenreIds,
              minYear,
              maxYear,
            },
            seedsResolved: seeds,
            results: top3,
          },
        });

        const old = (await ai.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          skip: 3,
          select: { id: true },
        })) as Array<{ id: string }>;

        if (old.length > 0) {
          await ai.deleteMany({
            where: { id: { in: old.map((r: { id: string }) => r.id) } },
          });
        }
      });
    } catch (persistErr) {
      console.warn("AiLabRecommendation persist failed (db not updated yet?)", persistErr);
    }

    return NextResponse.json({
      model: claude.model,
      parsed: {
        seeds: seedTitles,
        mediaPreference,
        movieGenreIds,
        tvGenreIds,
        excludeMovieGenreIds,
        excludeTvGenreIds,
        minYear,
        maxYear,
      },
      seedsResolved: seeds,
      limit,
      results: publicResults,
    });
  } catch (err) {
    console.error("POST /api/lab/ai/recommendations error", err);
    return NextResponse.json({ error: "Erro ao gerar recomendações." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = clampInt(url.searchParams.get("limit"), 3, 1, 3);

    try {
      const ai = (prisma as any).aiLabRecommendation as any;
      const rows = (await ai.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      })) as any[];

      return NextResponse.json({
        limit,
        data: rows,
      });
    } catch {
      return NextResponse.json({
        limit,
        data: [],
      });
    }
  } catch (err) {
    console.error("GET /api/lab/ai/recommendations error", err);
    return NextResponse.json({ error: "Erro ao buscar histórico." }, { status: 500 });
  }
}
