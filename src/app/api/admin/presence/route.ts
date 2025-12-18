import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type SessionUser = {
  id?: string;
  email?: string;
  name?: string | null;
  role?: string;
};

type AdminSession = {
  user?: SessionUser;
} | null;

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = parseInt(value || "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function overlapSeconds({
  start,
  end,
  windowStart,
  windowEnd,
}: {
  start: Date;
  end: Date;
  windowStart: Date;
  windowEnd: Date;
}) {
  const s = Math.max(start.getTime(), windowStart.getTime());
  const e = Math.min(end.getTime(), windowEnd.getTime());
  if (e <= s) return 0;
  return Math.floor((e - s) / 1000);
}

export async function GET(request: Request) {
  try {
    const session = (await getServerSession(authOptions)) as AdminSession;

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const now = new Date();
    const url = new URL(request.url);

    const onlineWindowSec = clampInt(url.searchParams.get("onlineWindowSec"), 90, 30, 600);
    const windowDays = clampInt(url.searchParams.get("windowDays"), 7, 1, 90);

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startWindow = new Date(now);
    startWindow.setDate(now.getDate() - windowDays);

    const onlineCutoff = new Date(now.getTime() - onlineWindowSec * 1000);

    const [onlineSessions, sessionsWindow] = await Promise.all([
      prisma.userPresenceSession.findMany({
        where: {
          endedAt: null,
          lastSeenAt: { gte: onlineCutoff },
        },
        select: {
          userId: true,
          sessionId: true,
          startedAt: true,
          lastSeenAt: true,
        },
      }),
      prisma.userPresenceSession.findMany({
        where: {
          lastSeenAt: { gte: startWindow },
        },
        select: {
          userId: true,
          startedAt: true,
          lastSeenAt: true,
          endedAt: true,
        },
      }),
    ]);

    const onlineUsersSet = new Set(onlineSessions.map((s) => s.userId));

    const secondsByUserToday = new Map<string, number>();
    const secondsByUserWindow = new Map<string, number>();

    for (const s of sessionsWindow) {
      const end = s.endedAt ? s.endedAt : s.lastSeenAt;

      const secToday = overlapSeconds({
        start: s.startedAt,
        end,
        windowStart: startOfToday,
        windowEnd: now,
      });

      const secWindow = overlapSeconds({
        start: s.startedAt,
        end,
        windowStart: startWindow,
        windowEnd: now,
      });

      if (secToday > 0) {
        secondsByUserToday.set(s.userId, (secondsByUserToday.get(s.userId) || 0) + secToday);
      }
      if (secWindow > 0) {
        secondsByUserWindow.set(s.userId, (secondsByUserWindow.get(s.userId) || 0) + secWindow);
      }
    }

    const totalSecondsToday = Array.from(secondsByUserToday.values()).reduce((a, b) => a + b, 0);
    const totalSecondsWindow = Array.from(secondsByUserWindow.values()).reduce((a, b) => a + b, 0);

    const topUsers = Array.from(secondsByUserWindow.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, seconds]) => ({ userId, seconds }));

    const users = await prisma.user.findMany({
      where: { id: { in: topUsers.map((t) => t.userId) } },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      now,
      onlineWindowSec,
      onlineNow: {
        sessions: onlineSessions.length,
        users: onlineUsersSet.size,
      },
      time: {
        todaySeconds: totalSecondsToday,
        windowDays,
        windowSeconds: totalSecondsWindow,
      },
      topUsers: topUsers.map((t) => ({
        user: userMap.get(t.userId) || { id: t.userId, email: "", name: null, role: "USER", createdAt: now },
        seconds: t.seconds,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/presence error", err);
    return NextResponse.json({ error: "Erro ao buscar presença." }, { status: 500 });
  }
}
