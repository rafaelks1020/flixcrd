import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getAuthUser } from "@/lib/auth-mobile";

function isValidId(value: unknown) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  if (v.length > 128) return false;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const sessionUserId = session?.user?.id as string | undefined;

    const bearerUser = sessionUserId ? null : await getAuthUser(request);
    const userId = sessionUserId || bearerUser?.id;

    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const end = url.searchParams.get("end") === "1";

    const body = await request.json().catch(() => ({}));
    const sessionId = (body as any)?.sessionId;
    const deviceId = (body as any)?.deviceId;
    const platform = (body as any)?.platform;

    if (!isValidId(sessionId)) {
      return NextResponse.json({ error: "sessionId inválido." }, { status: 400 });
    }

    const now = new Date();
    const userAgent = request.headers.get("user-agent") || null;

    const safeDeviceId = isValidId(deviceId) ? String(deviceId) : null;
    const safePlatform = typeof platform === "string" && platform.trim() ? platform.trim().slice(0, 32) : "web";

    const existing = await prisma.userPresenceSession.findUnique({
      where: { sessionId: String(sessionId) },
      select: { id: true, userId: true, startedAt: true, lastSeenAt: true, endedAt: true },
    });

    if (!existing) {
      if (end) {
        return NextResponse.json({ ok: true });
      }

      await prisma.userPresenceSession.create({
        data: {
          userId,
          sessionId: String(sessionId),
          deviceId: safeDeviceId,
          platform: safePlatform,
          userAgent,
          startedAt: now,
          lastSeenAt: now,
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Sessão não pertence ao usuário." }, { status: 403 });
    }

    const update: any = {
      lastSeenAt: now,
    };

    if (end) {
      update.endedAt = now;
    } else if (existing.endedAt) {
      update.endedAt = null;
    }

    await prisma.userPresenceSession.update({
      where: { sessionId: String(sessionId) },
      data: update,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/presence/heartbeat error", err);
    return NextResponse.json({ error: "Erro ao registrar presença." }, { status: 500 });
  }
}
