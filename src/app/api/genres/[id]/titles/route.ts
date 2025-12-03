import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Cache por 5 minutos
export const revalidate = 300;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 24;
    const skip = (page - 1) * pageSize;

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
      orderBy: {
        title: {
          voteAverage: "desc", // Ordena por nota (melhores primeiro)
        },
      },
      skip,
      take: pageSize,
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
