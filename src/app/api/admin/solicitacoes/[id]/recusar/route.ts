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

// POST /api/admin/solicitacoes/[id]/recusar
// Marca a solicitação como REJECTED com motivo e registra no histórico
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { id } = await context.params;
    const adminId = (session.user as any).id as string | undefined;

    const body = await request.json().catch(() => ({}));
    const { reason } = body as { reason?: string };

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Motivo da recusa é obrigatório." },
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
      data: { status: "REJECTED" as any },
    });

    await prisma.requestHistory.create({
      data: {
        requestId: id,
        action: "REJECTED" as any,
        message: reason,
        adminId: adminId ?? null,
      },
    });

    // Notificar dono e seguidores sobre recusa
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
        title: "Sua solicitação foi recusada",
        message: `Sua solicitação "${existing.title}" foi recusada. Motivo: ${reason}.`,
        data: { requestId: id, type: "REQUEST_REJECTED" },
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
          subject: "Sua solicitação foi recusada",
          fromEmail: "contato@pflix.com.br",
          fromName: "FlixCRD",
          meta: {
            reason: "request-status-changed",
            userId: existing.userId,
            requestId: existing.id,
            extra: {
              type: "REJECTED",
            },
          },
          context: {
            requestId: existing.id,
            status: "REJECTED",
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Sua solicitação foi recusada</h2>
              <p>Olá!</p>
              <p>Sua solicitação <strong>${existing.title}</strong> foi recusada.</p>
              <p><strong>Motivo:</strong> ${reason}</p>
              <p style="color: #666; font-size: 14px;">Em caso de dúvidas, responda este email ou entre em contato com o suporte.</p>
            </div>
          `,
          text: `
Sua solicitação foi recusada

Sua solicitação "${existing.title}" foi recusada.
Motivo: ${reason}

Em caso de dúvidas, responda este email ou entre em contato com o suporte.
          `,
        });
      }
    } catch (notifyError) {
       
      console.error("Failed to send push for request reject:", notifyError);
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    console.error("POST /api/admin/solicitacoes/[id]/recusar error", error);
    return NextResponse.json(
      { error: "Erro ao recusar solicitação." },
      { status: 500 },
    );
  }
}
