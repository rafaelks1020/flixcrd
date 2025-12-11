import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json();
    const { titleIds } = body as { titleIds: string[] };

    if (!Array.isArray(titleIds) || titleIds.length === 0) {
      return NextResponse.json(
        { error: "titleIds deve ser um array não vazio." },
        { status: 400 },
      );
    }

    // Contagem total de episódios por título
    const totalGroups = await prisma.episode.groupBy({
      by: ["titleId"],
      where: {
        titleId: {
          in: titleIds,
        },
      },
      _count: {
        _all: true,
      },
    });

    // Contagem de episódios considerados "sem upload" (sem hlsPath definido)
    const pendingGroups = await prisma.episode.groupBy({
      by: ["titleId"],
      where: {
        titleId: {
          in: titleIds,
        },
        OR: [
          { hlsPath: null },
          { hlsPath: "" },
        ],
      },
      _count: {
        _all: true,
      },
    });

    const summary: Record<string, { total: number; pending: number }> = {};

    for (const group of totalGroups) {
      summary[group.titleId] = {
        total: group._count._all,
        pending: 0,
      };
    }

    for (const group of pendingGroups) {
      if (!summary[group.titleId]) {
        summary[group.titleId] = {
          total: 0,
          pending: group._count._all,
        };
      } else {
        summary[group.titleId].pending = group._count._all;
      }
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("POST /api/admin/titles/pending-episodes-summary error", error);
    return NextResponse.json(
      { error: "Erro ao calcular resumo de episódios pendentes." },
      { status: 500 },
    );
  }
}
