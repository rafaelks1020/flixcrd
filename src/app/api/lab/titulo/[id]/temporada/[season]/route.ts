import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

interface TmdbEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

interface TmdbSeasonDetails {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: TmdbEpisode[];
}

interface LabEpisode {
  episodeNumber: number;
  name: string;
  overview: string;
  stillUrl: string | null;
  airDate: string | null;
  runtime: number | null;
  voteAverage: number;
}

interface LabSeasonDetails {
  seasonNumber: number;
  name: string;
  overview: string;
  posterUrl: string | null;
  airDate: string | null;
  episodes: LabEpisode[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; season: string }> }
) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const { id, season } = await params;

    // Buscar detalhes da temporada no TMDB
    const seasonUrl = `${TMDB_API}/tv/${id}/season/${season}?api_key=${TMDB_KEY}&language=pt-BR`;

    const res = await fetch(seasonUrl, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return NextResponse.json({ error: "Temporada não encontrada" }, { status: 404 });
    }

    const details: TmdbSeasonDetails = await res.json();

    const result: LabSeasonDetails = {
      seasonNumber: details.season_number,
      name: details.name,
      overview: details.overview || "",
      posterUrl: details.poster_path
        ? `https://image.tmdb.org/t/p/w300${details.poster_path}`
        : null,
      airDate: details.air_date,
      episodes: (details.episodes || []).map((ep) => ({
        episodeNumber: ep.episode_number,
        name: ep.name,
        overview: ep.overview || "",
        stillUrl: ep.still_path
          ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
          : null,
        airDate: ep.air_date,
        runtime: ep.runtime,
        voteAverage: ep.vote_average || 0,
      })),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Lab /temporada error:", err);
    return NextResponse.json({ error: "Erro ao buscar temporada." }, { status: 500 });
  }
}
