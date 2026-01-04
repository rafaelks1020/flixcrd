import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { getAppSettings } from "@/lib/app-settings";
import { isExplicitContent } from "@/lib/content-filter";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

import { getAvailableTmdbIds } from "@/lib/superflix";

interface TmdbTrendingItem {
  id: number;
  media_type?: string;
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

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = parseInt(value || "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
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
    const typeRaw = (url.searchParams.get("type") || "all").toLowerCase();
    const timeRaw = (url.searchParams.get("time") || "week").toLowerCase();
    const limit = clampInt(url.searchParams.get("limit"), 24, 6, 48);

    const type: "movie" | "tv" | "all" = typeRaw === "movie" ? "movie" : typeRaw === "tv" ? "tv" : "all";
    const time: "day" | "week" = timeRaw === "day" ? "day" : "week";

    const availableIds = await getAvailableTmdbIds();

    const endpoint = `${TMDB_API}/trending/${type}/${time}?api_key=${TMDB_KEY}&language=pt-BR`;
    const res = await fetch(endpoint, { next: { revalidate: 180 } });

    if (!res.ok) {
      return NextResponse.json({ error: "Falha ao consultar TMDB." }, { status: 502 });
    }

    const data = await res.json();
    const items: TmdbTrendingItem[] = Array.isArray(data?.results) ? data.results : [];

    const out: any[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      if (typeof item?.id !== "number") continue;

      // 1. Filtro por Categoria (Anime, Dorama, etc)
      if (category === "anime") {
        if (!item.genre_ids?.includes(16)) continue;
      } else if (category === "dorama") {
        // Para Trending, doramas podem ser difíceis de filtrar só por genre_ids sem languagem
        // Mas o TMDB Trending não dá original_language em massa em alguns casos, ou sim.
        // Vamos confiar nos genre_ids e talvez no fetch de detalhes se necessário, 
        // mas por agora mantemos o filtro de gênero se for série.
        if (item.media_type === "tv" && !item.genre_ids?.includes(18)) continue;
      }

      if (hideAdult && item.adult) continue;

      if (hideAdult) {
        const t = (item.title || item.name || "").toLowerCase();
        // Regex check
        if (isExplicitContent({
          name: item.name,
          title: item.title,
          overview: item.overview,
          adult: item.adult,
          genre_ids: item.genre_ids
        })) continue;
      }

      if (!availableIds.has(item.id)) continue;

      const resolvedMediaType: "movie" | "tv" | null =
        type === "movie" ? "movie" : type === "tv" ? "tv" : item.media_type === "tv" ? "tv" : item.media_type === "movie" ? "movie" : null;
      if (!resolvedMediaType) continue;

      const contentType = resolvedMediaType === "movie" ? "MOVIE" : "SERIES";

      const key = `${contentType}-${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        id: `lab-${resolvedMediaType}-${item.id}`,
        tmdbId: item.id,
        name: item.title || item.name || "Sem título",
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
        overview: item.overview || "",
        voteAverage: typeof item.vote_average === "number" ? item.vote_average : 0,
        releaseDate: item.release_date || item.first_air_date || null,
        type: contentType,
      });

      if (out.length >= limit) break;
    }

    return NextResponse.json({
      type,
      time,
      limit,
      results: out,
    });
  } catch (err) {
    console.error("Lab /trending error:", err);
    return NextResponse.json({ error: "Erro ao buscar trending." }, { status: 500 });
  }
}
