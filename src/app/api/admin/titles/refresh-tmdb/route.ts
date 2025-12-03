import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

interface SimpleTitle {
  id: string;
  tmdbId: number;
  type: "MOVIE" | "SERIES" | "ANIME" | "OTHER";
}

async function refreshTitleFromTmdb(title: SimpleTitle, apiKey: string) {
  const endpoint = title.type === "MOVIE" ? "movie" : "tv";
  const baseUrl = `https://api.themoviedb.org/3/${endpoint}/${title.tmdbId}`;

  // 1. Detalhes
  const detailsRes = await fetch(`${baseUrl}?api_key=${apiKey}&language=pt-BR`);
  if (!detailsRes.ok) {
    throw new Error(`Erro ao buscar detalhes TMDB para ${title.tmdbId}`);
  }
  const details: any = await detailsRes.json();

  // 2. Credits
  const creditsRes = await fetch(`${baseUrl}/credits?api_key=${apiKey}`);
  const credits: any = creditsRes.ok ? await creditsRes.json() : { cast: [], crew: [] };

  // 3. Vídeos
  const videosRes = await fetch(`${baseUrl}/videos?api_key=${apiKey}&language=pt-BR`);
  const videos: any = videosRes.ok ? await videosRes.json() : { results: [] };

  // Gêneros
  const genreIds: string[] = [];
  if (Array.isArray(details.genres)) {
    for (const g of details.genres as Array<{ id: number; name: string }>) {
      const genre = await prisma.genre.upsert({
        where: { tmdbId: g.id },
        update: { name: g.name },
        create: { tmdbId: g.id, name: g.name },
      });
      genreIds.push(genre.id);
    }
  }

  const name = details.title || details.name || "Sem título";

  // Atualizar Title
  const updatedTitle = await prisma.title.update({
    where: { id: title.id },
    data: {
      name,
      originalName: details.original_title || details.original_name || null,
      overview: details.overview || null,
      tagline: details.tagline || null,
      releaseDate:
        details.release_date || details.first_air_date
          ? new Date(details.release_date || details.first_air_date)
          : null,
      posterUrl: details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : null,
      backdropUrl: details.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
        : null,
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
    },
  });

  // Limpar vínculos antigos
  await prisma.titleGenre.deleteMany({ where: { titleId: title.id } });
  await prisma.cast.deleteMany({ where: { titleId: title.id } });
  await prisma.crew.deleteMany({ where: { titleId: title.id } });
  await prisma.video.deleteMany({ where: { titleId: title.id } });

  // Recriar gêneros
  for (const genreId of genreIds) {
    await prisma.titleGenre.create({ data: { titleId: title.id, genreId } });
  }

  // Elenco (top 20)
  if (Array.isArray(credits.cast)) {
    for (const c of (credits.cast as any[]).slice(0, 20)) {
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

  // Crew (diretor, roteirista, etc.)
  if (Array.isArray(credits.crew)) {
    const importantJobs = ["Director", "Writer", "Screenplay", "Producer"];
    const filtered = (credits.crew as any[]).filter((c) => importantJobs.includes(c.job));
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

  // Vídeos (trailers)
  if (Array.isArray(videos.results)) {
    for (const v of (videos.results as any[]).filter((v) => v.site === "YouTube")) {
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

  return updatedTitle;
}

export async function POST(_request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TMDB_API_KEY não configurado." },
        { status: 500 },
      );
    }

    const titles = await prisma.title.findMany({
      where: {
        tmdbId: { not: null },
        type: { in: ["MOVIE", "SERIES"] },
      },
      select: {
        id: true,
        tmdbId: true,
        type: true,
      },
    });

    let updated = 0;
    for (const t of titles as SimpleTitle[]) {
      try {
        await refreshTitleFromTmdb(t, apiKey);
        updated += 1;
      } catch (err) {
        console.error("Erro ao atualizar título", t.id, err);
      }
    }

    return NextResponse.json({
      total: titles.length,
      updated,
    });
  } catch (error) {
    console.error("POST /api/admin/titles/refresh-tmdb error", error);
    return NextResponse.json(
      { error: "Erro ao atualizar títulos a partir do TMDB." },
      { status: 500 },
    );
  }
}
