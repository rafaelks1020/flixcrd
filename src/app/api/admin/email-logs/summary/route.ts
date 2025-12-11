import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailStatus } from "@/types/email";

async function requireAdmin() {
  const session: any = await getServerSession(authOptions as any);

  if (!session || !session.user || (session.user as any).role !== "ADMIN") {
    return { isAdmin: false };
  }

  return { isAdmin: true };
}

export async function GET(_request: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalLast24h,
      successLast24h,
      errorLast24h,
      totalLast7d,
      errorLast7d,
      lastError,
      last7dReasonRows,
    ] = await prisma.$transaction([
      prisma.emailLog.count({
        where: { createdAt: { gte: last24h } },
      }),
      prisma.emailLog.count({
        where: { createdAt: { gte: last24h }, status: EmailStatus.SUCCESS },
      }),
      prisma.emailLog.count({
        where: { createdAt: { gte: last24h }, status: EmailStatus.ERROR },
      }),
      prisma.emailLog.count({
        where: { createdAt: { gte: last7d } },
      }),
      prisma.emailLog.count({
        where: { createdAt: { gte: last7d }, status: EmailStatus.ERROR },
      }),
      prisma.emailLog.findFirst({
        where: { status: EmailStatus.ERROR },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.emailLog.findMany({
        where: { createdAt: { gte: last7d } },
        select: { reason: true },
      }),
    ]);

    const reasonCounts = new Map<string, number>();
    for (const row of last7dReasonRows) {
      const key = row.reason ?? "(sem reason)";
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }

    const topReasonsLast7d = Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    const summary = {
      totalLast24h,
      successLast24h,
      errorLast24h,
      totalLast7d,
      errorLast7d,
      lastErrorAt: lastError?.createdAt ?? null,
      topReasonsLast7d,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/admin/email-logs/summary error", error);
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as any)?.code ?? null;

    return NextResponse.json(
      {
        error: "Erro ao carregar resumo de logs de email.",
        details: message,
        code,
      },
      { status: 500 },
    );
  }
}
