import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ positionSeconds: 0, durationSeconds: 0 });
    }

    const { id } = await context.params;
    const userId = (session.user as any).id as string;
    const episodeIdParam = request.nextUrl.searchParams.get("episodeId");
    const episodeId = episodeIdParam && episodeIdParam.trim().length > 0 ? episodeIdParam : null;

    let progress = null;

    if (episodeId) {
      // Progresso específico de episódio
      progress = await prisma.playbackProgress.findUnique({
        where: {
          userId_episodeId: {
            userId,
            episodeId,
          },
        },
      });
    } else {
      // Progresso por título (filmes)
      progress = await prisma.playbackProgress.findUnique({
        where: {
          userId_titleId: {
            userId,
            titleId: id,
          },
        },
      });
    }

    if (!progress) {
      return NextResponse.json({ positionSeconds: 0, durationSeconds: 0 });
    }

    return NextResponse.json({
      positionSeconds: progress.positionSeconds,
      durationSeconds: progress.durationSeconds,
    });
  } catch (error) {
    console.error("GET /api/titles/[id]/progress error", error);
    return NextResponse.json({ positionSeconds: 0, durationSeconds: 0 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await context.params;
    const userId = (session.user as any).id as string;

    const body = await request.json().catch(() => null);
    const rawPosition = body?.positionSeconds;
    const rawDuration = body?.durationSeconds;
    const bodyEpisodeId = body?.episodeId as string | undefined;

    const positionSeconds = Number.isFinite(rawPosition)
      ? Math.max(0, Math.floor(rawPosition))
      : 0;
    const durationSeconds = Number.isFinite(rawDuration)
      ? Math.max(0, Math.floor(rawDuration))
      : 0;

    if (!durationSeconds) {
      return NextResponse.json({ ok: true });
    }

    const episodeId = bodyEpisodeId && bodyEpisodeId.trim().length > 0 ? bodyEpisodeId : null;

    if (episodeId) {
      // Episódio específico: chave única por (userId, episodeId)
      await prisma.playbackProgress.upsert({
        where: {
          userId_episodeId: {
            userId,
            episodeId,
          },
        },
        update: {
          titleId: id,
          positionSeconds,
          durationSeconds,
        },
        create: {
          userId,
          titleId: id,
          episodeId,
          positionSeconds,
          durationSeconds,
        },
      });
    } else {
      // Filme (ou fallback): chave única por (userId, titleId)
      await prisma.playbackProgress.upsert({
        where: {
          userId_titleId: {
            userId,
            titleId: id,
          },
        },
        update: {
          positionSeconds,
          durationSeconds,
        },
        create: {
          userId,
          titleId: id,
          positionSeconds,
          durationSeconds,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/titles/[id]/progress error", error);
    return NextResponse.json(
      { error: "Erro ao salvar progresso." },
      { status: 500 },
    );
  }
}
