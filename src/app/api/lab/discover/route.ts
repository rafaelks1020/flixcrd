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
import { getAvailableTmdbIds } from "@/lib/superflix";

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
  } else if (category === "c-drama") {
    mediaType = "tv";
    params.set("with_original_language", "zh");
    params.set("with_genres", "18");
  } else if (category === "k-drama") {
    mediaType = "tv";
    params.set("with_original_language", "ko");
    params.set("with_genres", "18");
  } else if (category === "j-drama") {
    mediaType = "tv";
    params.set("with_original_language", "ja");
    params.set("with_genres", "18");
  } else if (category === "hindi-drama") {
    mediaType = "tv";
    params.set("with_original_language", "hi");
    params.set("with_genres", "18");
  } else if (category === "lakorn") {
    mediaType = "tv";
    params.set("with_original_language", "th");
    params.set("with_genres", "18");
  } else if (category === "serie") {
    mediaType = "tv";
    params.set("without_genres", "16"); // Hide animes from global series mostly
  }

  try {
    const availableIds = await getAvailableTmdbIds();

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
