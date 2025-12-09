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

const ALLOWED_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "IN_PRODUCTION",
  "UPLOADING",
  "COMPLETED",
  "REJECTED",
];

// POST /api/admin/solicitacoes/[id]/status
// Altera o status geral da solicitação e registra no histórico
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { id } = await context.params;
    const adminId = (session.user as any).id as string | undefined;

    const body = await request.json().catch(() => ({}));
    const { status, message } = body as { status?: string; message?: string };

    if (!status || typeof status !== "string") {
      return NextResponse.json(
        { error: "Status é obrigatório." },
        { status: 400 },
      );
    }

    const normalized = status.toUpperCase();
    if (!ALLOWED_STATUSES.includes(normalized)) {
      return NextResponse.json(
        { error: "Status inválido." },
        { status: 400 },
      );
    }

    const existing = await prisma.request.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Solicitação não encontrada." },
        { status: 404 },
      );
    }

    const updated = await prisma.request.update({
      where: { id },
      data: { status: normalized as any },
    });

    await prisma.requestHistory.create({
      data: {
        requestId: id,
        action: "STATUS_CHANGED" as any,
        message:
          message ??
          `Status alterado de ${existing.status} para ${normalized}`,
        adminId: adminId ?? null,
      },
    });

    // Notificar dono e seguidores sobre mudança de status
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
        title: "Status da solicitação atualizado",
        message: `Sua solicitação "${existing.title}" agora está com status ${normalized}.`,
        data: { requestId: id, type: "REQUEST_STATUS_CHANGED", status: normalized },
      });
    } catch (notifyError) {
      // eslint-disable-next-line no-console
      console.error("Failed to send push for request status change:", notifyError);
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    console.error("POST /api/admin/solicitacoes/[id]/status error", error);
    return NextResponse.json(
      { error: "Erro ao alterar status da solicitação." },
      { status: 500 },
    );
  }
}
