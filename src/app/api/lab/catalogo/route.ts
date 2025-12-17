import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";

const SUPERFLIX_API = "https://superflixapi.run";
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

  const enabled = user.role === "ADMIN" || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
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

    // Buscar IDs da SuperFlixAPI
    const listaUrl = `${SUPERFLIX_API}/lista?category=${category}&type=tmdb&format=json&order=desc`;
    const listaRes = await fetch(listaUrl, {
      headers: { "User-Agent": "FlixCRD-Lab/1.0" },
      next: { revalidate: 300 },
    });

    if (!listaRes.ok) {
      return NextResponse.json({ error: "Erro ao buscar lista", items: [] });
    }

    const listaText = await listaRes.text();
    
    // Parsear a resposta (pode ser array de IDs ou objeto)
    let ids: number[] = [];
    try {
      const parsed = JSON.parse(listaText);
      if (Array.isArray(parsed)) {
        ids = parsed.map((id: string | number) => parseInt(String(id))).filter((id: number) => !isNaN(id));
      } else if (parsed.ids) {
        ids = parsed.ids.map((id: string | number) => parseInt(String(id))).filter((id: number) => !isNaN(id));
      } else if (parsed.data) {
        ids = parsed.data.map((item: { id?: number; tmdb_id?: number }) => item.id || item.tmdb_id).filter(Boolean);
      }
    } catch {
      // Se não for JSON, tentar parsear como lista separada por linha/vírgula
      ids = listaText
        .split(/[\n,]/)
        .map((s: string) => parseInt(s.trim()))
        .filter((id: number) => !isNaN(id));
    }

    // Limitar quantidade
    const limitedIds = ids.slice(0, limit);

    // Buscar detalhes do TMDB para cada ID (preservando a ordem do /lista)
    const resolved = await Promise.all(
      limitedIds.map(async (tmdbId) => {
        const details = await fetchTmdbDetails(tmdbId, mediaType);
        if (!details) return null;

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
