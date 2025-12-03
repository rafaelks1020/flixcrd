import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;

  const titles = await prisma.title.findMany({
    where: q
      ? {
          name: {
            contains: q,
            mode: "insensitive",
          },
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(titles);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdbId, type } = body ?? {};

    if (!tmdbId || !type) {
      return NextResponse.json(
        { error: "Campos obrigatórios: tmdbId, type (MOVIE/SERIES)." },
        { status: 400 },
      );
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TMDB_API_KEY não configurado." },
        { status: 500 },
      );
    }

    const endpoint = type === "MOVIE" ? "movie" : "tv";
    const baseUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}`;

    // 1. Buscar detalhes completos
    const detailsRes = await fetch(`${baseUrl}?api_key=${apiKey}&language=pt-BR`);
    if (!detailsRes.ok) {
      return NextResponse.json(
        { error: "Erro ao buscar detalhes do TMDB." },
        { status: 500 },
      );
    }
    const details: any = await detailsRes.json();

    // 2. Buscar credits (elenco e crew)
    const creditsRes = await fetch(`${baseUrl}/credits?api_key=${apiKey}`);
    const credits: any = creditsRes.ok ? await creditsRes.json() : { cast: [], crew: [] };

    // 3. Buscar vídeos (trailers)
    const videosRes = await fetch(`${baseUrl}/videos?api_key=${apiKey}&language=pt-BR`);
    const videos: any = videosRes.ok ? await videosRes.json() : { results: [] };

    // Montar slug
    const name = details.title || details.name || "Sem título";
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Criar ou buscar gêneros
    const genreIds: string[] = [];
    if (Array.isArray(details.genres)) {
      for (const g of details.genres) {
        const genre = await prisma.genre.upsert({
          where: { tmdbId: g.id },
          update: { name: g.name },
          create: { tmdbId: g.id, name: g.name },
        });
        genreIds.push(genre.id);
      }
    }

    // Criar título
    const title = await prisma.title.create({
      data: {
        tmdbId,
        type,
        slug,
        name,
        originalName: details.original_title || details.original_name || null,
        overview: details.overview || null,
        tagline: details.tagline || null,
        releaseDate: details.release_date || details.first_air_date
          ? new Date(details.release_date || details.first_air_date)
          : null,
        posterUrl: details.poster_path
          ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
          : null,
        backdropUrl: details.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
          : null,
        logoUrl: null, // TMDB não retorna logo diretamente, precisa de endpoint /images
        runtime: details.runtime || details.episode_run_time?.[0] || null,
        voteAverage: details.vote_average || null,
        voteCount: details.vote_count || null,
        popularity: details.popularity || null,
        status: details.status || null,
        originalLanguage: details.original_language || null,
        spokenLanguages: details.spoken_languages
          ? JSON.stringify(details.spoken_languages)
          : null,
        productionCountries: details.production_countries
          ? JSON.stringify(details.production_countries)
          : null,
        hlsPath: null,
      },
    });

    // Associar gêneros
    for (const genreId of genreIds) {
      await prisma.titleGenre.create({
        data: { titleId: title.id, genreId },
      });
    }

    // Salvar elenco (top 20)
    if (Array.isArray(credits.cast)) {
      for (const c of credits.cast.slice(0, 20)) {
        await prisma.cast.create({
          data: {
            titleId: title.id,
            tmdbId: c.id,
            name: c.name,
            character: c.character || null,
            order: c.order ?? 999,
            profilePath: c.profile_path
              ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
              : null,
          },
        });
      }
    }

    // Salvar crew (diretor, roteirista, etc.)
    if (Array.isArray(credits.crew)) {
      const importantJobs = ["Director", "Writer", "Screenplay", "Producer"];
      const filtered = credits.crew.filter((c: any) =>
        importantJobs.includes(c.job),
      );
      for (const c of filtered.slice(0, 10)) {
        await prisma.crew.create({
          data: {
            titleId: title.id,
            tmdbId: c.id,
            name: c.name,
            job: c.job,
            department: c.department || null,
            profilePath: c.profile_path
              ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
              : null,
          },
        });
      }
    }

    // Salvar vídeos (trailers oficiais)
    if (Array.isArray(videos.results)) {
      for (const v of videos.results.filter((v: any) => v.site === "YouTube")) {
        await prisma.video.create({
          data: {
            titleId: title.id,
            key: v.key,
            name: v.name,
            site: v.site,
            type: v.type,
            official: v.official ?? false,
            publishedAt: v.published_at ? new Date(v.published_at) : null,
          },
        });
      }
    }

    return NextResponse.json(title, { status: 201 });
  } catch (error) {
    console.error("POST /api/titles error", error);
    return NextResponse.json(
      { error: "Erro ao criar título." },
      { status: 500 },
    );
  }
}
