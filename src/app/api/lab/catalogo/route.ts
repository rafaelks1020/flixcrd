import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { getSuperflixUrl } from "@/lib/app-settings";
import { isExplicitContent } from "@/lib/content-filter";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

interface TmdbMovie {
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
  adult?: boolean;
  genre_ids?: number[];
}

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

async function fetchTmdbDetails(tmdbId: number, mediaType: "movie" | "tv"): Promise<TmdbMovie | null> {
  try {
    // Para filmes, buscar também external_ids para pegar imdb_id
    const appendParam = mediaType === "movie" ? "&append_to_response=external_ids" : "";
    const res = await fetch(
      `${TMDB_API}/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&language=pt-BR${appendParam}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const SUPERFLIX_API = await getSuperflixUrl();

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "movie"; // movie, serie, anime
    const limit = parseInt(url.searchParams.get("limit") || "20");

    // Mapear tipo para categoria da SuperFlixAPI
    let category = "movie";
    let mediaType: "movie" | "tv" = "movie";
    if (type === "serie" || type === "series") {
      category = "serie";
      mediaType = "tv";
    }
    if (type === "anime" || type === "animes") {
      category = "anime";
      mediaType = "tv";
    }
    if (type === "dorama" || type === "doramas") {
      category = "dorama";
      mediaType = "tv";
    }
    if (type === "c-drama") {
      category = "c-drama";
      mediaType = "tv";
    }
    if (type === "k-drama") {
      category = "k-drama";
      mediaType = "tv";
    }
    if (type === "j-drama") {
      category = "j-drama";
      mediaType = "tv";
    }
    if (type === "hindi-drama") {
      category = "hindi-drama";
      mediaType = "tv";
    }
    if (type === "lakorn") {
      category = "lakorn";
      mediaType = "tv";
    }

    // Buscar IDs da SuperFlixAPI usando o utilitário centralizado
    const { getAvailableIdsByCategory } = await import("@/lib/superflix");
    const ids = await getAvailableIdsByCategory(category);

    // Limitar quantidade
    const limitedIds = ids.slice(0, limit);

    // Buscar detalhes do TMDB para cada ID (preservando a ordem do /lista)
    const resolved = await Promise.all(
      limitedIds.map(async (tmdbId) => {
        const details = await fetchTmdbDetails(tmdbId, mediaType);
        if (!details) return null;

        // Filtro imediato de conteúdo adulto usando os metadados REAIS do TMDB
        if (isExplicitContent({
          name: details.title || details.name || "",
          overview: details.overview || "",
          adult: details.adult,
          genre_ids: details.genre_ids
        })) {
          return null;
        }

        const imdbId = details.imdb_id || details.external_ids?.imdb_id || null;

        const item: LabTitle = {
          id: `lab-${mediaType}-${tmdbId}`,
          tmdbId,
          imdbId,
          name: details.title || details.name || "Sem título",
          posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
          backdropUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
          overview: details.overview || "",
          voteAverage: details.vote_average || 0,
          releaseDate: details.release_date || details.first_air_date || null,
          type: mediaType === "movie" ? "MOVIE" : "SERIES",
        };

        return item;
      })
    );

    const items: LabTitle[] = resolved.filter(Boolean) as LabTitle[];

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Lab /catalogo error:", err);
    return NextResponse.json({ error: "Erro ao consultar catálogo.", items: [] }, { status: 500 });
  }
}
