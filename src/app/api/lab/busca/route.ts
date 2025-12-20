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
  original_title?: string;
  original_name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  media_type: string;
}

interface LabSearchResult {
  id: string;
  tmdbId: number;
  imdbId: string | null;
  name: string;
  originalName?: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  voteAverage: number;
  releaseDate: string | null;
  type: string;
  popularity?: number;
  _relevanceScore?: number;
}

function calculateRelevanceScore(item: TmdbSearchResult, query: string): number {
  const q = query.toLowerCase().trim();
  const title = (item.title || item.name || "").toLowerCase();
  const originalTitle = (item.original_title || item.original_name || "").toLowerCase();
  const overview = (item.overview || "").toLowerCase();
  
  let score = 0;
  
  // Match exato no título (peso alto)
  if (title === q) score += 100;
  else if (title.startsWith(q)) score += 80;
  else if (title.includes(q)) score += 50;
  
  // Match no título original
  if (originalTitle === q) score += 90;
  else if (originalTitle.startsWith(q)) score += 70;
  else if (originalTitle.includes(q)) score += 40;
  
  // Match na sinopse (peso menor)
  if (overview.includes(q)) score += 20;
  
  // Boost por popularidade e avaliação
  const popularity = typeof item.popularity === "number" ? item.popularity : 0;
  const voteAverage = typeof item.vote_average === "number" ? item.vote_average : 0;
  const voteCount = typeof item.vote_count === "number" ? item.vote_count : 0;
  
  score += Math.min(30, popularity * 0.1);
  score += Math.min(20, voteAverage * 2);
  score += Math.min(15, voteCount * 0.01);
  
  // Penalidade para itens sem poster
  if (!item.poster_path) score -= 10;
  
  // Boost para lançamentos recentes (últimos 3 anos)
  const releaseDate = item.release_date || item.first_air_date;
  if (releaseDate) {
    const year = parseInt(releaseDate.substring(0, 4), 10);
    const currentYear = new Date().getFullYear();
    if (year >= currentYear - 3) score += 10;
  }
  
  return score;
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

      // Calcular relevância e ordenar
      const scoredItems = tmdbResults
        .filter(item => item.media_type === "movie" || item.media_type === "tv")
        .filter(item => availableIds.has(item.id))
        .filter(item => !seenTmdbIds.has(item.id))
        .map(item => ({
          item,
          score: calculateRelevanceScore(item, q)
        }))
        .sort((a, b) => b.score - a.score);

      for (const { item, score } of scoredItems) {
        seenTmdbIds.add(item.id);

        results.push({
          id: `lab-${item.media_type}-${item.id}`,
          tmdbId: item.id,
          imdbId: null,
          name: item.title || item.name || "Sem título",
          originalName: item.original_title || item.original_name || undefined,
          posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
          overview: item.overview || "",
          voteAverage: item.vote_average || 0,
          popularity: item.popularity,
          releaseDate: item.release_date || item.first_air_date || null,
          type: item.media_type === "movie" ? "MOVIE" : "SERIES",
          _relevanceScore: score,
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

    // Gerar sugestões se poucos resultados
    const suggestions: string[] = [];
    if (results.length < 3 && q.length > 2) {
      // Sugestões baseadas em correções comuns
      const commonMisspellings: Record<string, string> = {
        "starnger": "stranger",
        "breking": "breaking",
        "avengers": "vingadores",
        "spiderman": "homem aranha",
        "batman": "batman",
        "superman": "superman",
        "starwars": "star wars",
        "gameofthrones": "game of thrones",
        "harrypotter": "harry potter",
      };

      const normalized = q.toLowerCase().replace(/\s+/g, "");
      if (commonMisspellings[normalized]) {
        suggestions.push(commonMisspellings[normalized]);
      }

      // Sugerir termos relacionados se busca for muito específica
      if (q.includes("filme") || q.includes("movie")) {
        suggestions.push(q.replace(/filme|movie/gi, "").trim());
      }
      if (q.includes("série") || q.includes("series")) {
        suggestions.push(q.replace(/série|series/gi, "").trim());
      }

      // Remover duplicatas e filtrar vazios
      const uniqueSuggestions = [...new Set(suggestions)].filter(s => s && s !== q);
      suggestions.length = 0;
      suggestions.push(...uniqueSuggestions.slice(0, 3));
    }

    return NextResponse.json({
      results,
      page,
      limit,
      totalPages,
      scannedPages,
      tmdbPageEnd,
      hasMore,
      nextPage,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      query: q,
    });
  } catch (err) {
    console.error("Lab /busca error:", err);
    return NextResponse.json({ error: "Erro ao consultar busca.", results: [] }, { status: 500 });
  }
}
