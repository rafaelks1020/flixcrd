import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { getAppSettings } from "@/lib/app-settings";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

let availableIdsCache: { ids: Set<number>; cachedAt: number; apiUrl: string } | null = null;
const AVAILABLE_IDS_TTL_MS = 5 * 60 * 1000;

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = parseInt(value || "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseIds(rawText: string): number[] {
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return parsed
        .map((id: string | number) => parseInt(String(id), 10))
        .filter((n: number) => !Number.isNaN(n));
    }
    if (parsed && typeof parsed === "object") {
      if (Array.isArray((parsed as any).ids)) {
        return (parsed as any).ids
          .map((id: string | number) => parseInt(String(id), 10))
          .filter((n: number) => !Number.isNaN(n));
      }
      if (Array.isArray((parsed as any).data)) {
        return (parsed as any).data
          .map((item: any) => parseInt(String(item?.id ?? item?.tmdb_id ?? ""), 10))
          .filter((n: number) => !Number.isNaN(n));
      }
    }
  } catch {
    // ignore
  }

  return rawText
    .split(/[\n,]/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

async function fetchAvailableIds(SUPERFLIX_API: string): Promise<Set<number>> {
  const now = Date.now();
  if (availableIdsCache && now - availableIdsCache.cachedAt < AVAILABLE_IDS_TTL_MS && availableIdsCache.apiUrl === SUPERFLIX_API) {
    return availableIdsCache.ids;
  }

  const urls = [
    `${SUPERFLIX_API}/lista?category=movie&type=tmdb&format=json&order=desc`,
    `${SUPERFLIX_API}/lista?category=serie&type=tmdb&format=json&order=desc`,
    `${SUPERFLIX_API}/lista?category=anime&type=tmdb&format=json&order=desc`,
    `${SUPERFLIX_API}/lista?category=dorama&type=tmdb&format=json&order=desc`,
  ];

  const settled = await Promise.allSettled(
    urls.map((u) =>
      fetch(u, {
        headers: { "User-Agent": "FlixCRD-Lab/1.0" },
        next: { revalidate: 300 },
      })
    )
  );

  const ids = new Set<number>();
  for (const res of settled) {
    if (res.status !== "fulfilled") continue;
    if (!res.value.ok) continue;
    const text = await res.value.text();
    for (const id of parseIds(text)) {
      ids.add(id);
    }
  }

  availableIdsCache = { ids, cachedAt: now, apiUrl: SUPERFLIX_API };
  return ids;
}

type Seed = { mediaType: "movie" | "tv"; id: number };

function parseSeeds(raw: string): Seed[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const out: Seed[] = [];
  const seen = new Set<string>();

  for (const p of parts) {
    const [typeRaw, idRaw] = p.split(":");
    const type = (typeRaw || "").trim().toLowerCase();
    const id = parseInt((idRaw || "").trim(), 10);
    if (!Number.isFinite(id)) continue;
    if (type !== "movie" && type !== "tv") continue;
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ mediaType: type, id });
  }

  return out.slice(0, 6);
}

import { isExplicitContent } from "@/lib/content-filter";

interface TmdbRecItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  adult?: boolean;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!TMDB_KEY) {
    return NextResponse.json({ error: "TMDB_API_KEY não configurada." }, { status: 500 });
  }

  try {
    const settings = await getAppSettings();
    const SUPERFLIX_API = settings.superflixApiUrl;
    const hideAdult = settings.hideAdultContent;

    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "all";
    const seedsRaw = url.searchParams.get("seeds") || "";
    const limit = clampInt(url.searchParams.get("limit"), 24, 6, 48);

    const seeds = parseSeeds(seedsRaw);
    if (seeds.length === 0) {
      return NextResponse.json({ results: [], seeds, limit });
    }

    const availableIds = await fetchAvailableIds(SUPERFLIX_API);

    const out: any[] = [];
    const seen = new Set<string>();

    for (const seed of seeds) {
      const recUrl = `${TMDB_API}/${seed.mediaType}/${seed.id}/recommendations?api_key=${TMDB_KEY}&language=pt-BR&page=1`;
      const recRes = await fetch(recUrl, { next: { revalidate: 300 } });
      if (!recRes.ok) continue;

      const recJson = await recRes.json();
      const items: TmdbRecItem[] = Array.isArray(recJson?.results) ? recJson.results : [];

      for (const item of items) {
        if (typeof item?.id !== "number") continue;
        if (hideAdult && item.adult) continue;

        // 1. Filtro por Categoria (Anime, Dorama, etc)
        if (category === "anime") {
          // No TMDB, animes geralmente têm o gênero 16 (Animation)
          // Mas como recomendações vêm de uma semente, se a semente for anime, as recs tendem a ser tb.
          // Porém, para garantir, verificamos metadados. (TmdbRecItem não tem genre_ids por padrão na interface, vamos adicionar)
          if (!(item as any).genre_ids?.includes(16)) continue;
        }

        if (hideAdult) {
          if (isExplicitContent({
            name: item.title || item.name || "",
            overview: item.overview || "",
            adult: item.adult,
            genre_ids: (item as any).genre_ids
          })) continue;
        }

        if (!availableIds.has(item.id)) continue;

        const type = seed.mediaType === "movie" ? "MOVIE" : "SERIES";
        const key = `${type}-${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          id: `lab-${seed.mediaType}-${item.id}`,
          tmdbId: item.id,
          name: item.title || item.name || "Sem título",
          posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
          overview: item.overview || "",
          voteAverage: typeof item.vote_average === "number" ? item.vote_average : 0,
          releaseDate: item.release_date || item.first_air_date || null,
          type,
        });

        if (out.length >= limit) break;
      }

      if (out.length >= limit) break;
    }

    return NextResponse.json({
      seeds,
      limit,
      results: out.slice(0, limit),
    });
  } catch (err) {
    console.error("Lab /recommendations error:", err);
    return NextResponse.json({ error: "Erro ao buscar recomendações." }, { status: 500 });
  }
}
