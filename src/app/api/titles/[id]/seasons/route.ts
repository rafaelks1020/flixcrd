import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/titles/[id]/seasons
 * Retorna todas as temporadas e episódios de um título
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Buscar temporadas com episódios
    const seasons = await prisma.season.findMany({
      where: { titleId: id },
      orderBy: { seasonNumber: "asc" },
      include: {
        episodes: {
          orderBy: { episodeNumber: "asc" },
          select: {
            id: true,
            episodeNumber: true,
            name: true,
            overview: true,
            stillUrl: true,
            runtime: true,
            airDate: true,
            hlsPath: true,
          },
        },
      },
    });

    return NextResponse.json(seasons);
  } catch (error) {
    console.error("GET /api/titles/[id]/seasons error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar temporadas" },
      { status: 500 }
    );
  }
}
