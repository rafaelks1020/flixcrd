import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const titleGenres = await prisma.titleGenre.findMany({
      where: { genreId: id },
      include: {
        title: {
          select: {
            id: true,
            name: true,
            slug: true,
            posterUrl: true,
            backdropUrl: true,
            voteAverage: true,
            releaseDate: true,
            type: true,
          },
        },
      },
      take: 20,
    });

    const titles = titleGenres.map((tg: any) => tg.title);

    return NextResponse.json(titles);
  } catch (error) {
    console.error("GET /api/genres/[id]/titles error", error);
    return NextResponse.json(
      { error: "Erro ao listar títulos do gênero." },
      { status: 500 },
    );
  }
}
