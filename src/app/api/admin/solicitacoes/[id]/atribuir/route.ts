import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/admin/solicitacoes/[id]/atribuir
// Admin assume o caso e registra no histórico
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { id } = await context.params;
    const adminId = (session.user as any).id as string | undefined;

    const body = await request.json().catch(() => ({}));
    const { message } = body as { message?: string };

    const existing = await prisma.request.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Solicitação não encontrada." },
        { status: 404 },
      );
    }

    await prisma.requestHistory.create({
      data: {
        requestId: id,
        action: "ASSIGNED" as any,
        message: message ?? null,
        adminId: adminId ?? null,
      },
    });

    // Notificar dono e seguidores que a solicitação foi assumida
    try {
      const followers = await prisma.requestFollower.findMany({
        where: { requestId: id },
        select: { userId: true },
      });

      const userIds = [
        existing.userId,
        ...followers.map((f) => f.userId),
      ];

      await sendPushToUsers(userIds, {
        title: "Sua solicitação foi assumida",
        message: `Um administrador assumiu a solicitação "${existing.title}".`,
        data: { requestId: id, type: "REQUEST_ASSIGNED" },
      });
    } catch (notifyError) {
      // eslint-disable-next-line no-console
      console.error("Failed to send push for request assign:", notifyError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/solicitacoes/[id]/atribuir error", error);
    return NextResponse.json(
      { error: "Erro ao atribuir solicitação." },
      { status: 500 },
    );
  }
}
