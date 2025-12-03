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
        seasons: {
          orderBy: { seasonNumber: "asc" },
          select: {
            id: true,
            seasonNumber: true,
            name: true,
            overview: true,
            airDate: true,
            posterUrl: true,
            episodeCount: true,
            episodes: {
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
          seasons: {
            orderBy: { seasonNumber: "asc" },
            select: {
              id: true,
              seasonNumber: true,
              name: true,
              overview: true,
              airDate: true,
              posterUrl: true,
              episodeCount: true,
              episodes: {
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

    return NextResponse.json(title);
  } catch (error) {
    console.error("GET /api/admin/titles/[id]/seasons error", error);
    return NextResponse.json(
      { error: "Erro ao carregar temporadas/episódios." },
      { status: 500 },
    );
  }
}
