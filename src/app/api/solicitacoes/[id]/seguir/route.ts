import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await context.params;

    const requestRecord = await prisma.request.findUnique({
      where: { id },
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: "Solicitação não encontrada." },
        { status: 404 },
      );
    }

    const existingFollower = await prisma.requestFollower.findFirst({
      where: {
        requestId: id,
        userId: user.id,
      },
    });

    if (existingFollower) {
      return NextResponse.json({ alreadyFollowing: true });
    }

    await prisma.requestFollower.create({
      data: {
        requestId: id,
        userId: user.id,
      },
    });

    await prisma.request.update({
      where: { id },
      data: {
        followersCount: {
          increment: 1,
        },
      },
    });

    await prisma.requestHistory.create({
      data: {
        requestId: id,
        action: "FOLLOWED" as any,
        message: null,
        adminId: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/solicitacoes/[id]/seguir error", error);
    return NextResponse.json(
      { error: "Erro ao seguir solicitação." },
      { status: 500 },
    );
  }
}
