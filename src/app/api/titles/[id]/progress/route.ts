import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileOwnershipCache = new Map<string, { ok: boolean; expiresAt: number }>();

async function profileBelongsToUser(profileId: string, userId: string) {
  const key = `${userId}:${profileId}`;
  const cached = profileOwnershipCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ok;
  }

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: { id: true },
  });

  const ok = Boolean(profile);
  profileOwnershipCache.set(key, { ok, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
  return ok;
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ positionSeconds: 0, durationSeconds: 0 });
    }

    const { id } = await context.params;
    const userId = authUser.id;
    const episodeIdParam = request.nextUrl.searchParams.get("episodeId");
    const profileId = request.headers.get("x-profile-id") || request.nextUrl.searchParams.get("profileId");
    const episodeId = episodeIdParam && episodeIdParam.trim().length > 0 ? episodeIdParam : null;

    if (!profileId) {
      return NextResponse.json({ positionSeconds: 0, durationSeconds: 0 });
    }

    const hasAccess = await profileBelongsToUser(profileId, userId);
    if (!hasAccess) {
      return NextResponse.json({ positionSeconds: 0, durationSeconds: 0 });
    }

    let progress = null;

    if (episodeId) {
      // Progresso específico de episódio
      progress = await prisma.playbackProgress.findUnique({
        where: {
          profileId_episodeId: {
            profileId,
            episodeId,
          },
        },
        select: {
          positionSeconds: true,
          durationSeconds: true,
        },
      });
    } else {
      // Progresso por título (filmes)
      progress = await prisma.playbackProgress.findUnique({
        where: {
          profileId_titleId: {
            profileId,
            titleId: id,
          },
        },
        select: {
          positionSeconds: true,
          durationSeconds: true,
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
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ ok: true });
    }

    const { id } = await context.params;
    const userId = authUser.id;

    const body = await request.json().catch(() => null);
    const rawPosition = body?.positionSeconds;
    const rawDuration = body?.durationSeconds;
    const bodyEpisodeId = body?.episodeId as string | undefined;
    const profileId = body?.profileId as string | undefined;

    if (!profileId) {
      return NextResponse.json({ ok: true });
    }

    const hasAccess = await profileBelongsToUser(profileId, userId);
    if (!hasAccess) {
      return NextResponse.json({ ok: true });
    }

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
      // Episódio específico: chave única por (profileId, episodeId)
      await prisma.playbackProgress.upsert({
        where: {
          profileId_episodeId: {
            profileId,
            episodeId,
          },
        },
        update: {
          titleId: id,
          positionSeconds,
          durationSeconds,
        },
        create: {
          profileId,
          titleId: id,
          episodeId,
          positionSeconds,
          durationSeconds,
        },
      });
    } else {
      // Filme (ou fallback): chave única por (profileId, titleId)
      await prisma.playbackProgress.upsert({
        where: {
          profileId_titleId: {
            profileId,
            titleId: id,
          },
        },
        update: {
          positionSeconds,
          durationSeconds,
        },
        create: {
          profileId,
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
