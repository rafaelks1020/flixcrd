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

    const prismaAny = prisma as any;
    if (!prismaAny.playbackProgress?.findMany) {
      return NextResponse.json([]);
    }

    const items = await prismaAny.playbackProgress.findMany({
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
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
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

        return {
          id: item.title.id,
          name: item.title.name,
          slug: item.title.slug,
          posterUrl: item.title.posterUrl,
          backdropUrl: item.title.backdropUrl,
          voteAverage: item.title.voteAverage,
          releaseDate: item.title.releaseDate
            ? item.title.releaseDate.toISOString()
            : null,
          type: item.title.type,
          positionSeconds: item.positionSeconds,
          durationSeconds: item.durationSeconds,
          progressPercent: percent,
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
