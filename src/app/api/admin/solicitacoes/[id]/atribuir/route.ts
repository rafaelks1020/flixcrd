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

    await prisma.request.update({
      where: { id },
      data: {
        assignedAdminId: adminId ?? null,
        assignedAt: new Date(),
      },
    });

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
          subject: "Sua solicitação foi assumida",
          fromEmail: "contato@pflix.com.br",
          fromName: "FlixCRD",
          meta: {
            reason: "request-status-changed",
            userId: existing.userId,
            requestId: existing.id,
            extra: {
              type: "ASSIGNED",
            },
          },
          context: {
            requestId: existing.id,
            status: "ASSIGNED",
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Sua solicitação foi assumida</h2>
              <p>Olá!</p>
              <p>Um administrador assumiu a solicitação <strong>${existing.title}</strong>.</p>
              <p>Você será notificado quando houver novas atualizações.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/solicitacoes" 
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Ver minhas solicitações
                </a>
              </p>
            </div>
          `,
          text: `
Sua solicitação foi assumida

Um administrador assumiu a solicitação "${existing.title}".
Você será notificado quando houver novas atualizações.

Acesse: ${appUrl}/solicitacoes
          `,
        });
      }
    } catch (notifyError) {
       
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
