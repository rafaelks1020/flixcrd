import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

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

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";

    if (!q.trim()) {
      return NextResponse.json({ results: [] });
    }

    // Buscar no TMDB multi search (filmes + séries)
    const searchUrl = `${TMDB_API}/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(q)}&page=1`;
    
    const res = await fetch(searchUrl, { next: { revalidate: 300 } });
    
    if (!res.ok) {
      return NextResponse.json({ error: "Erro na busca", results: [] });
    }

    const data = await res.json();
    const tmdbResults: TmdbSearchResult[] = data.results || [];

    // Filtrar apenas filmes e séries, e converter para o formato Lab
    const results: LabSearchResult[] = tmdbResults
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .slice(0, 20)
      .map((item) => ({
        id: `lab-${item.media_type}-${item.id}`,
        tmdbId: item.id,
        imdbId: null, // Será preenchido quando clicar para assistir
        name: item.title || item.name || "Sem título",
        posterUrl: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null,
        backdropUrl: item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : null,
        overview: item.overview || "",
        voteAverage: item.vote_average || 0,
        releaseDate: item.release_date || item.first_air_date || null,
        type: item.media_type === "movie" ? "MOVIE" : "SERIES",
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Lab /busca error:", err);
    return NextResponse.json({ error: "Erro ao consultar busca.", results: [] }, { status: 500 });
  }
}
