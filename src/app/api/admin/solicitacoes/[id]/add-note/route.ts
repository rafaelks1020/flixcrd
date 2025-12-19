import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/admin/solicitacoes/[id]/add-note
// Adiciona uma anotacao interna ao historico da solicitacao (NOTE_ADDED)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 403 });
    }

    const { id } = await context.params;
    const adminId = (session.user as any).id as string | undefined;

    const body = await request.json().catch(() => ({}));
    const { message } = body as { message?: string };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Mensagem da nota e obrigatoria." },
        { status: 400 },
      );
    }

    const existing = await prisma.request.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Solicitacao nao encontrada." },
        { status: 404 },
      );
    }

    await prisma.requestHistory.create({
      data: {
        requestId: id,
        action: "NOTE_ADDED" as any,
        message: message.trim(),
        adminId: adminId ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/solicitacoes/[id]/add-note error", error);
    return NextResponse.json(
      { error: "Erro ao adicionar nota interna." },
      { status: 500 },
    );
  }
}
