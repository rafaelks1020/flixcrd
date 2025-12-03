import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function importSeasonForTitle(options: {
  titleId: string;
  titleSlug: string;
  tmdbId: number;
  seasonNumber: number;
  apiKey: string;
}) {
  const { titleId, titleSlug, tmdbId, seasonNumber, apiKey } = options;

  const url = new URL(
    `${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?language=pt-BR`,
  );
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("TMDB season import error", res.status, text);
    throw new Error(
      `Erro ao buscar temporada ${seasonNumber} da série TMDB ${tmdbId}.`,
    );
  }

  const data: any = await res.json();

  const season = await prisma.season.upsert({
    where: {
      titleId_seasonNumber: {
        titleId,
        seasonNumber,
      },
    },
    update: {
      name: data.name || data.title || null,
      overview: data.overview || null,
      airDate: data.air_date ? new Date(data.air_date) : null,
      posterUrl: data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : null,
      episodeCount: Array.isArray(data.episodes) ? data.episodes.length : null,
    },
    create: {
      titleId,
      seasonNumber,
      name: data.name || data.title || null,
      overview: data.overview || null,
      airDate: data.air_date ? new Date(data.air_date) : null,
      posterUrl: data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : null,
      episodeCount: Array.isArray(data.episodes) ? data.episodes.length : null,
    },
  });

  let created = 0;
  let updated = 0;

  if (Array.isArray(data.episodes)) {
    for (const ep of data.episodes as any[]) {
      const episodeNumber: number = ep.episode_number;
      if (!episodeNumber || episodeNumber <= 0) continue;

      const baseData = {
        titleId,
        seasonId: season.id,
        tmdbId: typeof ep.id === "number" ? ep.id : null,
        seasonNumber,
        episodeNumber,
        name: ep.name || `Episódio ${episodeNumber}`,
        overview: ep.overview || null,
        airDate: ep.air_date ? new Date(ep.air_date) : null,
        runtime: typeof ep.runtime === "number" ? ep.runtime : null,
        stillUrl: ep.still_path
          ? `https://image.tmdb.org/t/p/w780${ep.still_path}`
          : null,
      };

      const hlsPrefix = `titles/${titleSlug}/s${seasonNumber}/e${String(
        episodeNumber,
      ).padStart(2, "0")}/`;

      const existing = await prisma.episode.findUnique({
        where: {
          titleId_seasonNumber_episodeNumber: {
            titleId,
            seasonNumber,
            episodeNumber,
          },
        },
      });

      if (existing) {
        await prisma.episode.update({
          where: {
            titleId_seasonNumber_episodeNumber: {
              titleId,
              seasonNumber,
              episodeNumber,
            },
          },
          data: baseData,
        });
        updated += 1;
      } else {
        await prisma.episode.create({
          data: {
            ...baseData,
            hlsPath: hlsPrefix,
          },
        });
        created += 1;
      }
    }
  }

  return {
    season: {
      id: season.id,
      seasonNumber: season.seasonNumber,
      name: season.name,
      episodeCount: season.episodeCount,
    },
    episodes: {
      created,
      updated,
      total: created + updated,
    },
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    const body = (await request.json().catch(() => ({}))) as {
      seasonNumber?: number;
    };

    const seasonNumber = Number(body.seasonNumber);
    if (!Number.isFinite(seasonNumber) || seasonNumber <= 0) {
      return NextResponse.json(
        { error: "Parâmetro seasonNumber inválido." },
        { status: 400 },
      );
    }

    const title = await prisma.title.findUnique({
      where: { id },
      select: {
        id: true,
        tmdbId: true,
        slug: true,
        type: true,
      },
    });

    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    if (!title.tmdbId) {
      return NextResponse.json(
        { error: "Título não possui tmdbId configurado." },
        { status: 400 },
      );
    }

    const result = await importSeasonForTitle({
      titleId: title.id,
      titleSlug: title.slug,
      tmdbId: title.tmdbId,
      seasonNumber,
      apiKey,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/admin/titles/[id]/import-season error", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao importar temporada." },
      { status: 500 },
    );
  }
}
