import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Buscar todos os perfis do usuário
    const profiles = await prisma.profile.findMany({
      where: { userId },
      select: { id: true },
    });

    const profileIds = profiles.map((p) => p.id);

    // Tempo total assistido (soma de todos os progressos)
    const playbackData = await prisma.playbackProgress.findMany({
      where: {
        profileId: { in: profileIds },
      },
      select: {
        positionSeconds: true,
        durationSeconds: true,
      },
    });

    const totalWatchedSeconds = playbackData.reduce((acc, pb) => {
      // Considera apenas o que foi realmente assistido (posição atual)
      return acc + pb.positionSeconds;
    }, 0);

    const totalWatchedMinutes = Math.floor(totalWatchedSeconds / 60);
    const totalWatchedHours = Math.floor(totalWatchedMinutes / 60);

    // Títulos favoritos
    const favorites = await prisma.userFavorite.findMany({
      where: {
        profileId: { in: profileIds },
      },
      include: {
        Title: {
          select: {
            id: true,
            name: true,
            posterUrl: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    // Último acesso (último playback progress atualizado)
    const lastActivity = await prisma.playbackProgress.findFirst({
      where: {
        profileId: { in: profileIds },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        updatedAt: true,
        Title: {
          select: {
            name: true,
          },
        },
      },
    });

    // Títulos mais assistidos
    const mostWatched = await prisma.playbackProgress.groupBy({
      by: ["titleId"],
      where: {
        profileId: { in: profileIds },
      },
      _count: {
        titleId: true,
      },
      orderBy: {
        _count: {
          titleId: "desc",
        },
      },
      take: 5,
    });

    const mostWatchedTitles = await Promise.all(
      mostWatched.map(async (item) => {
        const title = await prisma.title.findUnique({
          where: { id: item.titleId },
          select: {
            id: true,
            name: true,
            posterUrl: true,
            type: true,
          },
        });
        return {
          ...title,
          viewCount: item._count.titleId,
        };
      })
    );

    return NextResponse.json({
      totalWatchedSeconds,
      totalWatchedMinutes,
      totalWatchedHours,
      favorites: favorites.map((f) => f.Title),
      lastActivity: lastActivity
        ? {
            date: lastActivity.updatedAt,
            title: lastActivity.Title.name,
          }
        : null,
      mostWatched: mostWatchedTitles,
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas do usuário:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas" },
      { status: 500 }
    );
  }
}
