import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";

// GET /api/profiles - Lista perfis do usuário logado
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const profiles = await prisma.profile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        avatar: true,
        isKids: true,
        useCloudflareProxy: true,
        createdAt: true,
      },
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error("GET /api/profiles error", error);
    return NextResponse.json(
      { error: "Erro ao carregar perfis." },
      { status: 500 },
    );
  }
}

// POST /api/profiles - Cria novo perfil
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { name, avatar, isKids, useCloudflareProxy } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Nome do perfil é obrigatório." },
        { status: 400 },
      );
    }

    // Limitar a 5 perfis por usuário
    const count = await prisma.profile.count({
      where: { userId: user.id },
    });

    if (count >= 5) {
      return NextResponse.json(
        { error: "Limite de 5 perfis por conta atingido." },
        { status: 400 },
      );
    }

    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        name: name.trim(),
        avatar: avatar || null,
        isKids: Boolean(isKids),
        useCloudflareProxy: Boolean(useCloudflareProxy),
      },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error: any) {
    // Log completo no servidor
    console.error("POST /api/profiles error", error);

    // Expor detalhes básicos para facilitar debug (especialmente em produção)
    const message = error?.message ?? "Erro desconhecido";
    const code = error?.code ?? undefined;

    return NextResponse.json(
      {
        error: "Erro ao criar perfil.",
        detail: message,
        code,
      },
      { status: 500 },
    );
  }
}
