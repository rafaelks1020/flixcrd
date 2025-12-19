import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Cache por 5 minutos
export const revalidate = 300;

export async function GET() {
  try {
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

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("GET /api/genres error", error);
    return NextResponse.json(
      { error: "Erro ao listar gêneros." },
      { status: 500 },
    );
  }
}
