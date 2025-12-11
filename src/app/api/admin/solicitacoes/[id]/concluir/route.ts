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
          subject: "Conteúdo disponível no catálogo",
          fromEmail: "contato@pflix.com.br",
          fromName: "FlixCRD",
          meta: {
            reason: "request-status-changed",
            userId: existing.userId,
            requestId: existing.id,
            extra: {
              type: "COMPLETED",
            },
          },
          context: {
            requestId: existing.id,
            status: "COMPLETED",
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Conteúdo disponível no catálogo</h2>
              <p>Olá!</p>
              <p>A solicitação <strong>${existing.title}</strong> foi concluída e o conteúdo está disponível no catálogo.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/browse" 
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Ver catálogo
                </a>
              </p>
            </div>
          `,
          text: `
Conteúdo disponível no catálogo

Sua solicitação "${existing.title}" foi concluída e o conteúdo está disponível no catálogo.

Acesse: ${appUrl}/browse
          `,
        });
      }
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
