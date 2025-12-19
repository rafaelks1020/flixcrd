import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

const SUPERFLIX_API = "https://superflixapi.run";
const TMDB_API = "https://api.themoviedb.org/3";

function parseIds(rawText: string): number[] {
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return parsed.map((id: any) => parseInt(String(id), 10)).filter((n: number) => !Number.isNaN(n));
    }
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.ids)) {
        return parsed.ids.map((id: any) => parseInt(String(id), 10)).filter((n: number) => !Number.isNaN(n));
      }
      if (Array.isArray(parsed.data)) {
        return parsed.data.map((item: any) => parseInt(String(item?.id ?? item?.tmdb_id ?? ""), 10)).filter((n: number) => !Number.isNaN(n));
      }
    }
  } catch { /* ignore */ }
  return rawText.split(/[\n,]/).map((s) => parseInt(s.trim(), 10)).filter((n: number) => !Number.isNaN(n));
}

async function fetchFromLab(type: string | null, page: number, pageSize: number): Promise<{ data: any[]; total: number; totalPages: number }> {
  const TMDB_KEY = process.env.TMDB_API_KEY || "";
  if (!TMDB_KEY) throw new Error("TMDB_API_KEY não configurada.");

  const mediaType = type === "SERIES" ? "tv" : "movie";
  const superflixCategory = type === "SERIES" ? "serie" : "movie";

  const listaRes = await fetch(`${SUPERFLIX_API}/lista?category=${superflixCategory}&type=tmdb&format=json&order=desc`, {
    headers: { "User-Agent": "FlixCRD-Lab/1.0" },
    next: { revalidate: 300 },
  });

  if (!listaRes.ok) throw new Error("Falha ao consultar /lista.");

  const listaText = await listaRes.text();
  const ids = parseIds(listaText);
  const idsSet = new Set(ids);

  const results: any[] = [];
  const seenTmdbIds = new Set<number>();
  let tmdbPage = page;
  let scannedPages = 0;
  let totalPages = 0;

  while (results.length < pageSize && scannedPages < 6) {
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language: "pt-BR",
      sort_by: "popularity.desc",
      page: String(tmdbPage),
      include_adult: "false",
      vote_count_gte: "20",
    });

    const tmdbUrl = `${TMDB_API}/discover/${mediaType}?${params.toString()}`;
    const tmdbRes = await fetch(tmdbUrl, { next: { revalidate: 300 } });
    if (!tmdbRes.ok) break;
    const tmdbJson = await tmdbRes.json();
    const pageResults: any[] = tmdbJson?.results ?? [];
    if (!totalPages) totalPages = tmdbJson?.total_pages || 0;

    for (const item of pageResults) {
      const tmdbId = item?.id;
      if (typeof tmdbId !== "number") continue;
      if (!idsSet.has(tmdbId)) continue;
      if (seenTmdbIds.has(tmdbId)) continue;
      seenTmdbIds.add(tmdbId);

      results.push({
        id: `lab-${mediaType}-${tmdbId}`,
        tmdbId,
        name: item?.title || item?.name || "Sem título",
        slug: `lab-${tmdbId}`,
        posterUrl: item?.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdropUrl: item?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        overview: item?.overview || "",
        voteAverage: typeof item?.vote_average === "number" ? item.vote_average : 0,
        releaseDate: item?.release_date || item?.first_air_date || null,
        type: mediaType === "movie" ? "MOVIE" : "SERIES",
        TitleGenre: [],
        genres: [],
      });

      if (results.length >= pageSize) break;
    }

    scannedPages += 1;
    tmdbPage += 1;
    if (tmdbPage > (totalPages || 500)) break;
    if (pageResults.length === 0) break;
  }

  return { data: results, total: ids.length, totalPages: Math.ceil(ids.length / pageSize) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? searchParams.get("search") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const genre = searchParams.get("genre") ?? undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "24", 10);
  const pageSize = Math.min(limit, 200);
  const skip = (page - 1) * pageSize;

  // Check Lab Mode
  const settings = await getSettings();
  const labEnabled = Boolean(settings.labEnabled);

  if (labEnabled && !q && !genre) {
    try {
      const labResult = await fetchFromLab(type ?? null, page, pageSize);
      return NextResponse.json({
        data: labResult.data,
        page,
        limit: pageSize,
        total: labResult.total,
        totalPages: labResult.totalPages,
        source: "lab",
      });
    } catch (err) {
      console.error("Lab fetch error, falling back to DB:", err);
      // Fall through to DB fetch
    }
  }

  // Standard DB fetch
  const where: any = {};

  if (q) {
    where.name = {
      contains: q,
      mode: "insensitive",
    };
  }

  if (type && type.toLowerCase() !== "all") {
    where.type = type;
  }

  if (genre) {
    where.TitleGenre = {
      some: {
        genreId: genre,
      },
    };
  }

  const total = await prisma.title.count({ where: Object.keys(where).length > 0 ? where : undefined });

  const titles = await prisma.title.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { popularity: "desc" },
    skip,
    take: pageSize,
    select: {
      id: true,
      tmdbId: true,
      name: true,
      slug: true,
      posterUrl: true,
      backdropUrl: true,
      voteAverage: true,
      releaseDate: true,
      type: true,
      originalName: true,
      overview: true,
      tagline: true,
      hlsPath: true,
      TitleGenre: {
        include: {
          Genre: true
        }
      }
    },
  });

  const titlesWithMappedGenres = titles.map(t => ({
    ...t,
    genres: t.TitleGenre.map(tg => ({
      genre: {
        id: tg.Genre.id,
        name: tg.Genre.name
      }
    }))
  }));

  return NextResponse.json({
    data: titlesWithMappedGenres,
    page,
    limit: pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    source: "db",
  });
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

    // Verificar se título já existe
    const existingTitle = await prisma.title.findUnique({
      where: { tmdbId },
    });

    if (existingTitle) {
      return NextResponse.json(
        { error: "Título já existe no catálogo.", title: existingTitle },
        { status: 409 },
      );
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
