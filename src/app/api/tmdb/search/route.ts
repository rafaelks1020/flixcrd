import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function extractImdbId(input: string) {
  const trimmed = input.trim();
  const direct = trimmed.match(/^(tt\d{5,})$/i);
  if (direct) return direct[1];

  const urlMatch = trimmed.match(/imdb\.com\/title\/(tt\d{5,})/i);
  if (urlMatch) return urlMatch[1];

  return null;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY não configurada no .env" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json(
      { error: "Parâmetro q (query) é obrigatório." },
      { status: 400 },
    );
  }

  const type = searchParams.get("type") || "multi"; // movie | tv | multi

  const imdbId = extractImdbId(q);
  if (imdbId) {
    const url = new URL(`${TMDB_BASE_URL}/find/${encodeURIComponent(imdbId)}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("external_source", "imdb_id");
    url.searchParams.set("language", "pt-BR");

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error("TMDb find error", await response.text());
      return NextResponse.json(
        { error: "Erro ao consultar TMDb" },
        { status: 500 },
      );
    }

    const data = await response.json();

    const rawResults: any[] = [
      ...(data.movie_results ?? []),
      ...(data.tv_results ?? []),
    ];

    const results = rawResults.slice(0, 10).map((item: any) => {
      const isMovie = Boolean(item.title);
      const releaseDate = isMovie ? item.release_date : item.first_air_date;

      return {
        tmdbId: item.id,
        type: isMovie ? "MOVIE" : "SERIES",
        name: item.title ?? item.name ?? "",
        originalName: item.original_title ?? item.original_name ?? null,
        overview: item.overview ?? "",
        releaseDate: releaseDate ?? null,
        posterUrl: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null,
        backdropUrl: item.backdrop_path
          ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
          : null,
        imdbId,
      };
    });

    return NextResponse.json({ results });
  }

  const url = new URL(`${TMDB_BASE_URL}/search/${type}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", q);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("page", "1");

  const response = await fetch(url.toString());

  if (!response.ok) {
    console.error("TMDb search error", await response.text());
    return NextResponse.json(
      { error: "Erro ao consultar TMDb" },
      { status: 500 },
    );
  }

  const data = await response.json();

  const results = (data.results ?? [])
    .filter((item: any) =>
      type === "movie" || type === "tv"
        ? true
        : item.media_type === "movie" || item.media_type === "tv",
    )
    .slice(0, 10)
    .map((item: any) => {
      const mediaType = item.media_type || type;
      const isMovie = mediaType === "movie";

      const releaseDate = isMovie
        ? item.release_date
        : item.first_air_date;

      return {
        tmdbId: item.id,
        type: isMovie ? "MOVIE" : "SERIES",
        name: item.title ?? item.name ?? "",
        originalName: item.original_title ?? item.original_name ?? null,
        overview: item.overview ?? "",
        releaseDate: releaseDate ?? null,
        posterUrl: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null,
        backdropUrl: item.backdrop_path
          ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
          : null,
      };
    });

  return NextResponse.json({ results });
}
