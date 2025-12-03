import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const userId = (session.user as any).id as string;

    const items = await prisma.playbackProgress.findMany({
      where: {
        userId,
        positionSeconds: { gt: 0 },
        durationSeconds: { gt: 0 },
      },
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
        episode: {
          select: {
            id: true,
            seasonNumber: true,
            episodeNumber: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 12, // Reduzido de 30 para 12 (suficiente para a home)
    });

    const titles = items
      .filter((item: any) => item.title)
      .map((item: any) => {
        const percent = item.durationSeconds
          ? Math.max(
              0,
              Math.min(
                100,
                Math.round((item.positionSeconds / item.durationSeconds) * 100),
              ),
            )
          : 0;

        const t = item.title!;
        const ep = item.episode;

        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          posterUrl: t.posterUrl,
          backdropUrl: t.backdropUrl,
          voteAverage: t.voteAverage,
          releaseDate: t.releaseDate ? t.releaseDate.toISOString() : null,
          type: t.type,
          positionSeconds: item.positionSeconds,
          durationSeconds: item.durationSeconds,
          progressPercent: percent,
          episodeId: ep?.id ?? null,
          seasonNumber: ep?.seasonNumber ?? null,
          episodeNumber: ep?.episodeNumber ?? null,
          episodeName: ep?.name ?? null,
        };
      });

    return NextResponse.json(titles);
  } catch (error) {
    console.error("GET /api/user/continue-watching error", error);
    return NextResponse.json(
      { error: "Erro ao listar Continuar assistindo." },
      { status: 500 },
    );
  }
}
