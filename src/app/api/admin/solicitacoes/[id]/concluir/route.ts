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

// POST /api/admin/solicitacoes/[id]/concluir
// Marca a solicitação como COMPLETED e registra no histórico
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

    const updated = await prisma.request.update({
      where: { id },
      data: {
        status: "COMPLETED" as any,
        workflowState: "PUBLISHED" as any,
      },
    });

    await prisma.requestHistory.create({
      data: {
        requestId: id,
        action: "COMPLETED" as any,
        message: message ?? null,
        adminId: adminId ?? null,
      },
    });

    // Notificar que o conteúdo foi disponibilizado no catálogo
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
        title: "Conteúdo disponível no catálogo",
        message: `A solicitação "${existing.title}" foi concluída e o conteúdo está disponível no catálogo.`,
        data: { requestId: id, type: "REQUEST_COMPLETED" },
      });
    } catch (notifyError) {
       
      console.error("Failed to send push for request complete:", notifyError);
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    console.error("POST /api/admin/solicitacoes/[id]/concluir error", error);
    return NextResponse.json(
      { error: "Erro ao concluir solicitação." },
      { status: 500 },
    );
  }
}
