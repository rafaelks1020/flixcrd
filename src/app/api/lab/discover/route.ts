import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";

const SUPERFLIX_API = "https://superflixapi.run";
const TMDB_API = "https://api.themoviedb.org/3";

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

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = parseInt(value || "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function mapSort(sort: string, mediaType: "movie" | "tv") {
  switch (sort) {
    case "most_watched":
      return "popularity.desc";
    case "most_liked":
      return "vote_average.desc";
    case "most_voted":
      return "vote_count.desc";
    case "newest":
      return mediaType === "movie" ? "primary_release_date.desc" : "first_air_date.desc";
    default:
      return "popularity.desc";
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

  const TMDB_KEY = process.env.TMDB_API_KEY || "";
  if (!TMDB_KEY) {
    return NextResponse.json({ error: "TMDB_API_KEY não configurada." }, { status: 500 });
  }

  try {
    const url = new URL(request.url);

    const category = (url.searchParams.get("category") || "movie").toLowerCase();
    const sort = (url.searchParams.get("sort") || "most_watched").toLowerCase();
    const year = url.searchParams.get("year");
    const genre = url.searchParams.get("genre");

    const page = clampInt(url.searchParams.get("page"), 1, 1, 500);
    const limit = clampInt(url.searchParams.get("limit"), 24, 6, 48);

    let mediaType: "movie" | "tv" = "movie";
    let superflixCategory = "movie";

    if (category === "serie" || category === "series" || category === "tv") {
      mediaType = "tv";
      superflixCategory = "serie";
    }

    if (category === "anime" || category === "animes") {
      mediaType = "tv";
      superflixCategory = "anime";
    }

    const listaUrl = `${SUPERFLIX_API}/lista?category=${superflixCategory}&type=tmdb&format=json&order=desc`;
    const listaRes = await fetch(listaUrl, {
      headers: { "User-Agent": "FlixCRD-Lab/1.0" },
      next: { revalidate: 300 },
    });

    if (!listaRes.ok) {
      return NextResponse.json({ error: "Falha ao consultar /lista." }, { status: 502 });
    }

    const listaText = await listaRes.text();
    const ids = parseIds(listaText);
    const idsSet = new Set(ids);

    const sortBy = mapSort(sort, mediaType);

    const results: any[] = [];
    let tmdbPage = page;
    let scannedPages = 0;

    while (results.length < limit && scannedPages < 6) {
      const params = new URLSearchParams({
        api_key: TMDB_KEY,
        language: "pt-BR",
        sort_by: sortBy,
        page: String(tmdbPage),
        include_adult: "false",
        include_video: "false",
      });

      if (genre) params.set("with_genres", genre);

      if (year) {
        if (mediaType === "movie") {
          params.set("primary_release_year", year);
        } else {
          params.set("first_air_date_year", year);
        }
      }

      if (category === "anime" || category === "animes") {
        params.set("with_genres", params.get("with_genres") ? `${params.get("with_genres")},16` : "16");
        params.set("with_original_language", "ja");
      }

      params.set("vote_count.gte", "20");

      const tmdbUrl = `${TMDB_API}/discover/${mediaType}?${params.toString()}`;
      const tmdbRes = await fetch(tmdbUrl, { next: { revalidate: 300 } });

      if (!tmdbRes.ok) {
        return NextResponse.json({ error: "Falha ao consultar TMDB." }, { status: 502 });
      }

      const tmdbJson = await tmdbRes.json();
      const pageResults: any[] = Array.isArray(tmdbJson?.results) ? tmdbJson.results : [];

      for (const item of pageResults) {
        const tmdbId = item?.id;
        if (typeof tmdbId !== "number") continue;
        if (!idsSet.has(tmdbId)) continue;

        results.push({
          id: `lab-${mediaType}-${tmdbId}`,
          tmdbId,
          name: item?.title || item?.name || "Sem título",
          posterUrl: item?.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdropUrl: item?.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
          overview: item?.overview || "",
          voteAverage: typeof item?.vote_average === "number" ? item.vote_average : 0,
          releaseDate: item?.release_date || item?.first_air_date || null,
          type: mediaType === "movie" ? "MOVIE" : "SERIES",
        });

        if (results.length >= limit) break;
      }

      scannedPages += 1;
      tmdbPage += 1;
      if (tmdbPage > (tmdbJson?.total_pages || 500)) break;
      if (pageResults.length === 0) break;
    }

    return NextResponse.json({
      page,
      limit,
      results,
      scannedPages,
      superflixCategory,
      sort,
    });
  } catch (err) {
    console.error("Lab /discover error:", err);
    return NextResponse.json({ error: "Erro ao montar catálogo inteligente." }, { status: 500 });
  }
}
