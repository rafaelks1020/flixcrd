import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { id } = await context.params;

    let title = await prisma.title.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        slug: true,
        tmdbId: true,
        Season: {
          orderBy: { seasonNumber: "asc" },
          select: {
            id: true,
            seasonNumber: true,
            name: true,
            overview: true,
            airDate: true,
            posterUrl: true,
            episodeCount: true,
            Episode: {
              orderBy: { episodeNumber: "asc" },
              select: {
                id: true,
                seasonNumber: true,
                episodeNumber: true,
                name: true,
                overview: true,
                airDate: true,
                runtime: true,
                stillUrl: true,
                hlsPath: true,
              },
            },
          },
        },
      },
    });

    // Fallback: permitir usar slug no lugar de id para compatibilidade com URLs antigas
    if (!title) {
      title = await prisma.title.findUnique({
        where: { slug: id },
        select: {
          id: true,
          name: true,
          type: true,
          slug: true,
          tmdbId: true,
          Season: {
            orderBy: { seasonNumber: "asc" },
            select: {
              id: true,
              seasonNumber: true,
              name: true,
              overview: true,
              airDate: true,
              posterUrl: true,
              episodeCount: true,
              Episode: {
                orderBy: { episodeNumber: "asc" },
                select: {
                  id: true,
                  seasonNumber: true,
                  episodeNumber: true,
                  name: true,
                  overview: true,
                  airDate: true,
                  runtime: true,
                  stillUrl: true,
                  hlsPath: true,
                },
              },
            },
          },
        },
      });
    }

    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    const seasons = (title.Season ?? []).map((season) => ({
      id: season.id,
      seasonNumber: season.seasonNumber,
      name: season.name,
      overview: season.overview,
      airDate: season.airDate,
      posterUrl: season.posterUrl,
      episodeCount: season.episodeCount,
      episodes: (season.Episode ?? []).map((ep) => ({
        id: ep.id,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        name: ep.name,
        overview: ep.overview,
        airDate: ep.airDate,
        runtime: ep.runtime,
        stillUrl: ep.stillUrl,
        hlsPath: ep.hlsPath,
      })),
    }));

    return NextResponse.json({
      id: title.id,
      name: title.name,
      type: title.type,
      slug: title.slug,
      tmdbId: title.tmdbId,
      seasons,
    });
  } catch (error) {
    console.error("GET /api/admin/titles/[id]/seasons error", error);
    return NextResponse.json(
      { error: "Erro ao carregar temporadas/episódios." },
      { status: 500 },
    );
  }
}
