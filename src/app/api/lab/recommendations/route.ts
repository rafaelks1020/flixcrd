import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { getAppSettings } from "@/lib/app-settings";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

import { getAvailableTmdbIds } from "@/lib/superflix";

type Seed = { mediaType: "movie" | "tv"; id: number };

function parseSeeds(raw: string): Seed[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const out: Seed[] = [];
  const seen = new Set<string>();

  for (const p of parts) {
    const [typeRaw, idRaw] = p.split(":");
    const type = (typeRaw || "").trim().toLowerCase();
    const id = parseInt((idRaw || "").trim(), 10);
    if (!Number.isFinite(id)) continue;
    if (type !== "movie" && type !== "tv") continue;
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ mediaType: type, id });
  }

  return out.slice(0, 6);
}

import { isExplicitContent } from "@/lib/content-filter";

interface TmdbRecItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  adult?: boolean;
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
    const seedsRaw = url.searchParams.get("seeds") || "";
    const limit = clampInt(url.searchParams.get("limit"), 24, 6, 48);

    const seeds = parseSeeds(seedsRaw);
    if (seeds.length === 0) {
      return NextResponse.json({ results: [], seeds, limit });
    }

    const availableIds = await getAvailableTmdbIds();

    const out: any[] = [];
    const seen = new Set<string>();

    for (const seed of seeds) {
      const recUrl = `${TMDB_API}/${seed.mediaType}/${seed.id}/recommendations?api_key=${TMDB_KEY}&language=pt-BR&page=1`;
      const recRes = await fetch(recUrl, { next: { revalidate: 300 } });
      if (!recRes.ok) continue;

      const recJson = await recRes.json();
      const items: TmdbRecItem[] = Array.isArray(recJson?.results) ? recJson.results : [];

      for (const item of items) {
        if (typeof item?.id !== "number") continue;
        if (hideAdult && item.adult) continue;

        // 1. Filtro por Categoria (Anime, Dorama, etc)
        if (category === "anime") {
          // No TMDB, animes geralmente têm o gênero 16 (Animation)
          // Mas como recomendações vêm de uma semente, se a semente for anime, as recs tendem a ser tb.
          // Porém, para garantir, verificamos metadados. (TmdbRecItem não tem genre_ids por padrão na interface, vamos adicionar)
          if (!(item as any).genre_ids?.includes(16)) continue;
        }

        if (hideAdult) {
          if (isExplicitContent({
            name: item.title || item.name || "",
            overview: item.overview || "",
            adult: item.adult,
            genre_ids: (item as any).genre_ids
          })) continue;
        }

        if (!availableIds.has(item.id)) continue;

        const type = seed.mediaType === "movie" ? "MOVIE" : "SERIES";
        const key = `${type}-${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          id: `lab-${seed.mediaType}-${item.id}`,
          tmdbId: item.id,
          name: item.title || item.name || "Sem título",
          posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
          overview: item.overview || "",
          voteAverage: typeof item.vote_average === "number" ? item.vote_average : 0,
          releaseDate: item.release_date || item.first_air_date || null,
          type,
        });

        if (out.length >= limit) break;
      }

      if (out.length >= limit) break;
    }

    return NextResponse.json({
      seeds,
      limit,
      results: out.slice(0, limit),
    });
  } catch (err) {
    console.error("Lab /recommendations error:", err);
    return NextResponse.json({ error: "Erro ao buscar recomendações." }, { status: 500 });
  }
}
