import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ positionSeconds: 0, durationSeconds: 0 });
    }

    const { id } = await context.params;
    const userId = (session.user as any).id as string;

    const prismaAny = prisma as any;
    if (!prismaAny.playbackProgress?.findUnique) {
      return NextResponse.json({ positionSeconds: 0, durationSeconds: 0 });
    }

    const progress = await prismaAny.playbackProgress.findUnique({
      where: {
        userId_titleId: {
          userId,
          titleId: id,
        },
      },
    });

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

    const positionSeconds = Number.isFinite(rawPosition)
      ? Math.max(0, Math.floor(rawPosition))
      : 0;
    const durationSeconds = Number.isFinite(rawDuration)
      ? Math.max(0, Math.floor(rawDuration))
      : 0;

    if (!durationSeconds) {
      return NextResponse.json({ ok: true });
    }

    const prismaAny = prisma as any;
    if (!prismaAny.playbackProgress?.upsert) {
      return NextResponse.json({ ok: true });
    }

    await prismaAny.playbackProgress.upsert({
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/titles/[id]/progress error", error);
    return NextResponse.json(
      { error: "Erro ao salvar progresso." },
      { status: 500 },
    );
  }
}
