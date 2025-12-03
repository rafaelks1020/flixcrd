import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Cache por 5 minutos
export const revalidate = 300;

export async function GET() {
  try {
    const genres = await prisma.genre.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { titles: true },
        },
      },
    });

    // Só retorna gêneros que têm pelo menos 1 título
    const filtered = genres.filter((g: any) => g._count.titles > 0);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("GET /api/genres error", error);
    return NextResponse.json(
      { error: "Erro ao listar gêneros." },
      { status: 500 },
    );
  }
}
