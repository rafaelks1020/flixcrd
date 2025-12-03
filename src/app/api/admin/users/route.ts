import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";

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
        avatar: true,
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

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { email, name, password, role } = body as {
      email?: string;
      name?: string | null;
      password?: string;
      role?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Já existe um usuário com este email." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const finalRole = role === "ADMIN" ? "ADMIN" : "USER";

    const created = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash,
        role: finalRole as any,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/users error", error);
    return NextResponse.json(
      { error: "Erro ao criar usuário." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, password } = body as { id?: string; password?: string };

    if (!id || !password) {
      return NextResponse.json(
        { error: "Parâmetros inválidos. Informe id e nova senha." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/admin/users error", error);
    return NextResponse.json(
      { error: "Erro ao atualizar senha do usuário." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json(
        { error: "Parâmetros inválidos. Informe id do usuário." },
        { status: 400 },
      );
    }

    const currentUserId = (session.user as any).id as string | undefined;
    if (currentUserId && currentUserId === id) {
      return NextResponse.json(
        { error: "Você não pode excluir o seu próprio usuário." },
        { status: 400 },
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/users error", error);
    return NextResponse.json(
      { error: "Erro ao excluir usuário." },
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
    const { id, role, name, avatar } = body as {
      id?: string;
      role?: string;
      name?: string | null;
      avatar?: string | null;
    };

    if (!id) {
      return NextResponse.json(
        { error: "Parâmetros inválidos. Informe id do usuário." },
        { status: 400 },
      );
    }

    const data: any = {};

    if (typeof role !== "undefined") {
      if (role !== "ADMIN" && role !== "USER") {
        return NextResponse.json(
          { error: "Role inválida. Use ADMIN ou USER." },
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

      data.role = role;
    }

    if (typeof name !== "undefined") {
      data.name = name ?? null;
    }

    if (typeof avatar !== "undefined") {
      data.avatar = avatar ?? null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
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
