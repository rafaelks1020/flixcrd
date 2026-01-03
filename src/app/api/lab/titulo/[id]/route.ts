import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

interface TmdbDetails {
  id: number;
  imdb_id?: string;
  external_ids?: { imdb_id?: string };
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  tagline?: string;
  seasons?: {
    id: number;
    season_number: number;
    name: string;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
    overview: string;
  }[];
}

interface LabTitleDetails {
  id: string;
  tmdbId: number;
  imdbId: string | null;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  voteAverage: number;
  releaseDate: string | null;
  runtime: number | null;
  genres: string[];
  type: "MOVIE" | "SERIES";
  status: string | null;
  tagline: string | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  seasons: {
    seasonNumber: number;
    name: string;
    episodeCount: number;
    airDate: string | null;
    posterUrl: string | null;
    overview: string;
  }[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const mediaType = url.searchParams.get("type") || "movie"; // movie ou tv

    // Buscar detalhes do TMDB
    const appendParam = mediaType === "movie" ? "&append_to_response=external_ids" : "&append_to_response=external_ids";
    const detailsUrl = `${TMDB_API}/${mediaType}/${id}?api_key=${TMDB_KEY}&language=pt-BR${appendParam}`;

    const res = await fetch(detailsUrl, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return NextResponse.json({ error: "Título não encontrado" }, { status: 404 });
    }

    const details: TmdbDetails = await res.json();

    const imdbId = details.imdb_id || details.external_ids?.imdb_id || null;

    const result: LabTitleDetails = {
      id: `lab-${mediaType}-${details.id}`,
      tmdbId: details.id,
      imdbId,
      name: details.title || details.name || "Sem título",
      posterUrl: details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : null,
      backdropUrl: details.backdrop_path
        ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
        : null,
      overview: details.overview || "",
      voteAverage: details.vote_average || 0,
      releaseDate: details.release_date || details.first_air_date || null,
      runtime: details.runtime || (details.episode_run_time?.[0]) || null,
      genres: details.genres?.map((g) => g.name) || [],
      type: mediaType === "movie" ? "MOVIE" : "SERIES",
      status: details.status || null,
      tagline: details.tagline || null,
      numberOfSeasons: details.number_of_seasons || null,
      numberOfEpisodes: details.number_of_episodes || null,
      seasons: (details.seasons || [])
        .filter((s) => s.season_number > 0) // Excluir "Specials" (season 0)
        .map((s) => ({
          seasonNumber: s.season_number,
          name: s.name,
          episodeCount: s.episode_count,
          airDate: s.air_date,
          posterUrl: s.poster_path
            ? `https://image.tmdb.org/t/p/w300${s.poster_path}`
            : null,
          overview: s.overview || "",
        })),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Lab /titulo error:", err);
    return NextResponse.json({ error: "Erro ao buscar detalhes." }, { status: 500 });
  }
}
