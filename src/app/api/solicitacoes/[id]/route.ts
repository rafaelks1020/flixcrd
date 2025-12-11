import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await context.params;

    const requestRecord = await prisma.request.findUnique({
      where: { id },
      include: {
        RequestHistory: {
          orderBy: { createdAt: "asc" },
        },
        AssignedAdmin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: "Solicitação não encontrada." },
        { status: 404 },
      );
    }

    if (requestRecord.userId !== user.id) {
      const follower = await prisma.requestFollower.findFirst({
        where: {
          requestId: id,
          userId: user.id,
        },
      });

      if (!follower) {
        return NextResponse.json(
          { error: "Solicitação não encontrada." },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(requestRecord);
  } catch (error) {
    console.error("GET /api/solicitacoes/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao carregar solicitação." },
      { status: 500 },
    );
  }
}
