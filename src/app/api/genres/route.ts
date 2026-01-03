import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import cache from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Try cache first
    const cacheKey = "genres:all";
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }

    const genres = await prisma.genre.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { TitleGenre: true },
        },
      },
    });

    // Só retorna gêneros que têm pelo menos 1 título e não são Terror/Horror
    const filtered = genres.filter((g: any) => {
      const name = g.name.toLowerCase();
      const isTerror = name === "terror" || name === "horror";
      return g._count.TitleGenre > 0 && !isTerror;
    });

    // Cache for 10 minutes (600 seconds)
    await cache.set(cacheKey, JSON.stringify(filtered), 600);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("GET /api/genres error", error);
    return NextResponse.json(
      { error: "Erro ao listar gêneros." },
      { status: 500 },
    );
  }
}
