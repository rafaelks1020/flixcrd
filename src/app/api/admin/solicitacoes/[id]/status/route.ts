import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { sendMail } from "@/lib/mailjet";

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

      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { email: true, name: true },
      });

      const emails = users
        .map((u) => u.email)
        .filter((email): email is string => Boolean(email));

      if (emails.length > 0) {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

        await sendMail({
          to: emails,
          subject: "Status da solicitação atualizado",
          fromEmail: "contato@pflix.com.br",
          fromName: "FlixCRD",
          meta: {
            reason: "request-status-changed",
            userId: existing.userId,
            requestId: existing.id,
            extra: {
              status: normalized,
            },
          },
          context: {
            requestId: existing.id,
            status: normalized,
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Status da solicitação atualizado</h2>
              <p>Olá!</p>
              <p>Sua solicitação <strong>${existing.title}</strong> agora está com status <strong>${normalized}</strong>.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/solicitacoes" 
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Ver minhas solicitações
                </a>
              </p>
            </div>
          `,
          text: `
Status da solicitação atualizado

Sua solicitação "${existing.title}" agora está com status ${normalized}.

Acesse: ${appUrl}/solicitacoes
          `,
        });
      }
    } catch (notifyError) {
       
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
