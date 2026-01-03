import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-mobile";
import { getAppSettings } from "@/lib/app-settings";
import { isExplicitContent } from "@/lib/content-filter";

const TMDB_API = "https://api.themoviedb.org/3";

interface LabTitle {
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

// Reuse availability fetching logic from other routes or centralize it
let availableIdsCache: { ids: Set<number>; cachedAt: number; apiUrl: string } | null = null;
const AVAILABLE_IDS_TTL_MS = 5 * 60 * 1000;

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

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const TMDB_KEY = process.env.TMDB_API_KEY || "";
  const url = new URL(request.url);
  const settings = await getAppSettings();

  const category = url.searchParams.get("category") || "movie";
  let mediaType: "movie" | "tv" = (category === "movie") ? "movie" : "tv";
  const page = url.searchParams.get("page") || "1";
  const sort = url.searchParams.get("sort") || "popularity.desc";

  // Build TMDB filters
  const params = new URLSearchParams();
  params.set("api_key", TMDB_KEY);
  params.set("language", "pt-BR");
  params.set("sort_by", sort);
  params.set("page", page);
  params.set("include_adult", "false");

  if (category === "anime") {
    mediaType = "tv";
    params.set("with_genres", "16"); // Animation
    params.set("with_keywords", "210024|287501"); // anime, manga related keywords if needed
  } else if (category === "dorama") {
    mediaType = "tv";
    params.set("with_original_language", "ko|ja");
    params.set("with_genres", "18"); // Drama
  } else if (category === "serie") {
    mediaType = "tv";
    params.set("without_genres", "16"); // Hide animes from global series mostly
  }

  try {
    const availableIds = await fetchAvailableIds(settings.superflixApiUrl);

    const tmdbUrl = `${TMDB_API}/discover/${mediaType}?${params.toString()}`;
    const res = await fetch(tmdbUrl);
    const data = await res.json();

    let results = Array.isArray(data.results) ? data.results : [];

    // Filter results based on settings and availability
    results = results.filter((item: any) => {
      // availability
      if (!availableIds.has(item.id)) return false;

      // explicit content
      if (settings.hideAdultContent) {
        if (isExplicitContent({
          name: item.title || item.name || "",
          overview: item.overview || "",
          adult: item.adult,
          genre_ids: item.genre_ids
        })) return false;
      }

      return true;
    });

    // Map to LabTitle format expected by frontend
    const mappedResults: LabTitle[] = results.map((item: any) => ({
      id: `lab-${mediaType}-${item.id}`,
      tmdbId: item.id,
      imdbId: null,
      name: item.title || item.name || "Sem título",
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
      overview: item.overview || "",
      voteAverage: item.vote_average || 0,
      releaseDate: item.release_date || item.first_air_date || null,
      type: mediaType === "movie" ? "MOVIE" : "SERIES",
    }));

    return NextResponse.json({
      results: mappedResults,
      page: data.page,
      total_pages: data.total_pages,
      total_results: data.total_results,
      hasMore: data.page < data.total_pages
    });
  } catch (error) {
    console.error("Discover error:", error);
    return NextResponse.json({ error: "Erro ao buscar do TMDB" }, { status: 500 });
  }
}
