import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/admin/solicitacoes/[id]/upload
// Relaciona a solicitação com um item do catálogo (Title) via RequestUpload
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { id } = await context.params;
    const adminId = (session.user as any).id as string | undefined;

    const body = await request.json().catch(() => ({}));
    const { titleId, completedAt } = body as {
      titleId?: string;
      completedAt?: string | null;
    };

    if (!titleId || typeof titleId !== "string") {
      return NextResponse.json(
        { error: "titleId é obrigatório." },
        { status: 400 },
      );
    }

    const requestRecord = await prisma.request.findUnique({ where: { id } });
    if (!requestRecord) {
      return NextResponse.json(
        { error: "Solicitação não encontrada." },
        { status: 404 },
      );
    }

    const title = await prisma.title.findUnique({ where: { id: titleId } });
    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    let completedAtDate: Date | null = null;
    if (completedAt) {
      const d = new Date(completedAt);
      if (!Number.isNaN(d.getTime())) {
        completedAtDate = d;
      }
    }

    const upload = await prisma.requestUpload.upsert({
      where: { requestId: id },
      update: {
        titleId,
        completedAt: completedAtDate,
      },
      create: {
        requestId: id,
        titleId,
        completedAt: completedAtDate,
      },
    });

    // Ao relacionar com o catálogo, marcamos status como UPLOADING
    await prisma.request.update({
      where: { id },
      data: {
        status: "UPLOADING" as any,
        workflowState: "UPLOAD_SERVER" as any,
      },
    });

    await prisma.requestHistory.create({
      data: {
        requestId: id,
        action: "LINKED_TO_CATALOG" as any,
        message: `Vinculado ao título ${title.name}`,
        adminId: adminId ?? null,
      },
    });

    return NextResponse.json({ ok: true, upload });
  } catch (error) {
    console.error("POST /api/admin/solicitacoes/[id]/upload error", error);
    return NextResponse.json(
      { error: "Erro ao relacionar upload da solicitação." },
      { status: 500 },
    );
  }
}
