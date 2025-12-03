import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/admin/users error", error);
    return NextResponse.json(
      { error: "Erro ao listar usuários." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, role } = body as { id?: string; role?: string };

    if (!id || (role !== "ADMIN" && role !== "USER")) {
      return NextResponse.json(
        { error: "Parâmetros inválidos. Informe id e role (ADMIN ou USER)." },
        { status: 400 },
      );
    }

    // Evita que o admin atual remova o próprio acesso admin por engano
    const currentUserId = (session.user as any).id as string | undefined;
    if (currentUserId && currentUserId === id && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Você não pode remover seu próprio acesso de administrador." },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/users error", error);
    return NextResponse.json(
      { error: "Erro ao atualizar usuário." },
      { status: 500 },
    );
  }
}
