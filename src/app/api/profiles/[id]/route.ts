import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/profiles/[id] - Busca perfil específico
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await context.params;

    const profile = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        isKids: true,
        useCloudflareProxy: true,
        createdAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("GET /api/profiles/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao carregar perfil." },
      { status: 500 },
    );
  }
}

// PATCH /api/profiles/[id] - Atualiza perfil
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, avatar, isKids, useCloudflareProxy } = body;

    // Verificar se perfil pertence ao usuário
    const existing = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    const profile = await prisma.profile.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(avatar !== undefined && { avatar: avatar || null }),
        ...(isKids !== undefined && { isKids: Boolean(isKids) }),
        ...(useCloudflareProxy !== undefined && {
          useCloudflareProxy: Boolean(useCloudflareProxy),
        }),
      },
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("PATCH /api/profiles/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil." },
      { status: 500 },
    );
  }
}

// DELETE /api/profiles/[id] - Deleta perfil
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await context.params;

    // Verificar se perfil pertence ao usuário
    const existing = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    // Verificar se não é o único perfil
    const count = await prisma.profile.count({
      where: { userId: session.user.id },
    });

    if (count <= 1) {
      return NextResponse.json(
        { error: "Não é possível deletar o único perfil da conta." },
        { status: 400 },
      );
    }

    await prisma.profile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/profiles/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao deletar perfil." },
      { status: 500 },
    );
  }
}
