import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [
      titlesCount,
      titlesWithHlsCount,
      usersCount,
      adminsCount,
      moviesCount,
      seriesCount,
      animesCount,
      recentTitles,
    ] = await Promise.all([
      prisma.title.count(),
      prisma.title.count({ where: { hlsPath: { not: null } } }),
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.title.count({ where: { type: "MOVIE" } }),
      prisma.title.count({ where: { type: "SERIES" } }),
      prisma.title.count({ where: { type: "ANIME" } }),
      prisma.title.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          posterUrl: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      titlesCount,
      titlesWithHlsCount,
      usersCount,
      adminsCount,
      moviesCount,
      seriesCount,
      animesCount,
      recentTitles,
    });
  } catch (error) {
    console.error("Erro ao buscar stats:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas" },
      { status: 500 }
    );
  }
}
