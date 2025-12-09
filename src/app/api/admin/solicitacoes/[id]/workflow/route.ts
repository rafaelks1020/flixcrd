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

// Estados permitidos em RequestWorkflowState
const ALLOWED_WORKFLOW_STATES = [
  "NONE",
  "TECH_ANALYSIS",
  "SOURCE_ACQUISITION",
  "ENCODING",
  "SUBTITLING",
  "UPLOAD_SERVER",
  "PUBLISHED",
] as const;

// POST /api/admin/solicitacoes/[id]/workflow
// Altera o workflow interno (estado opcional) e registra no histórico
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { id } = await context.params;
    const adminId = (session.user as any).id as string | undefined;

    const body = await request.json().catch(() => ({}));
    const { state, message } = body as { state?: string; message?: string };

    if (!state || typeof state !== "string") {
      return NextResponse.json(
        { error: "Estado (state) é obrigatório." },
        { status: 400 },
      );
    }

    const normalized = state.toUpperCase();
    if (!ALLOWED_WORKFLOW_STATES.includes(normalized as any)) {
      return NextResponse.json(
        { error: "Estado de workflow inválido." },
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
      data: {
        workflowState: normalized as any,
      },
    });

    await prisma.requestHistory.create({
      data: {
        requestId: id,
        action: "WORKFLOW_CHANGED" as any,
        message:
          message ??
          `Workflow alterado de ${existing.workflowState} para ${normalized}`,
        adminId: adminId ?? null,
      },
    });

    // Notificar quando workflow indicar que o conteúdo está em processamento
    if ([
      "TECH_ANALYSIS",
      "SOURCE_ACQUISITION",
      "ENCODING",
      "SUBTITLING",
      "UPLOAD_SERVER",
    ].includes(normalized)) {
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
          title: "Sua solicitação está em processamento",
          message: `A solicitação "${existing.title}" está na etapa ${normalized}.`,
          data: { requestId: id, type: "REQUEST_PROCESSING", state: normalized },
        });
      } catch (notifyError) {
        // eslint-disable-next-line no-console
        console.error("Failed to send push for request workflow:", notifyError);
      }
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    console.error("POST /api/admin/solicitacoes/[id]/workflow error", error);
    return NextResponse.json(
      { error: "Erro ao alterar workflow da solicitação." },
      { status: 500 },
    );
  }
}
