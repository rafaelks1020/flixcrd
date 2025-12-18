import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";

const SUPERFLIX_API = "https://superflixapi.run";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

let availableIdsCache: { ids: Set<number>; cachedAt: number } | null = null;
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

async function fetchAvailableIds(): Promise<Set<number>> {
  const now = Date.now();
  if (availableIdsCache && now - availableIdsCache.cachedAt < AVAILABLE_IDS_TTL_MS) {
    return availableIdsCache.ids;
  }

  const urls = [
    `${SUPERFLIX_API}/lista?category=movie&type=tmdb&format=json&order=desc`,
    `${SUPERFLIX_API}/lista?category=serie&type=tmdb&format=json&order=desc`,
    `${SUPERFLIX_API}/lista?category=anime&type=tmdb&format=json&order=desc`,
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

  availableIdsCache = { ids, cachedAt: now };
  return ids;
}

interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type: string;
}

interface LabSearchResult {
  id: string;
  tmdbId: number;
  imdbId: string | null;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  voteAverage: number;
  releaseDate: string | null;
  type: string;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const enabled = user.role === "ADMIN" || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!TMDB_KEY) {
    return NextResponse.json({ error: "TMDB_API_KEY não configurada." }, { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";

    const page = clampInt(url.searchParams.get("page"), 1, 1, 500);
    const limit = clampInt(url.searchParams.get("limit"), 20, 5, 40);

    if (!q.trim()) {
      return NextResponse.json({ results: [], page, limit, totalPages: 0, scannedPages: 0 });
    }

    const availableIds = await fetchAvailableIds();

    const results: LabSearchResult[] = [];
    const seenTmdbIds = new Set<number>();
    let tmdbPage = page;
    let scannedPages = 0;
    let totalPages = 0;

    while (results.length < limit && scannedPages < 4) {
      const searchUrl = `${TMDB_API}/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(q)}&page=${tmdbPage}&include_adult=false`;

      const res = await fetch(searchUrl, { next: { revalidate: 120 } });

      if (!res.ok) {
        return NextResponse.json({ error: "Erro na busca", results: [] });
      }

      const data = await res.json();
      const tmdbResults: TmdbSearchResult[] = data.results || [];
      if (!totalPages) totalPages = data?.total_pages || 0;

      for (const item of tmdbResults) {
        if (item.media_type !== "movie" && item.media_type !== "tv") continue;
        if (!availableIds.has(item.id)) continue;
        if (seenTmdbIds.has(item.id)) continue;
        seenTmdbIds.add(item.id);

        results.push({
          id: `lab-${item.media_type}-${item.id}`,
          tmdbId: item.id,
          imdbId: null,
          name: item.title || item.name || "Sem título",
          posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
          overview: item.overview || "",
          voteAverage: item.vote_average || 0,
          releaseDate: item.release_date || item.first_air_date || null,
          type: item.media_type === "movie" ? "MOVIE" : "SERIES",
        });

        if (results.length >= limit) break;
      }

      scannedPages += 1;
      tmdbPage += 1;
      if (!totalPages || tmdbPage > totalPages) break;
      if (tmdbResults.length === 0) break;
    }

    const tmdbPageEnd = tmdbPage - 1;
    const hasMore = totalPages ? tmdbPage <= totalPages : false;
    const nextPage = hasMore ? tmdbPageEnd + 1 : null;

    return NextResponse.json({
      results,
      page,
      limit,
      totalPages,
      scannedPages,
      tmdbPageEnd,
      hasMore,
      nextPage,
    });
  } catch (err) {
    console.error("Lab /busca error:", err);
    return NextResponse.json({ error: "Erro ao consultar busca.", results: [] }, { status: 500 });
  }
}
