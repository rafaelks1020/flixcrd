import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const userId = authUser.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { useCloudflareProxy: true },
    });

    return NextResponse.json({ useCloudflareProxy: user?.useCloudflareProxy ?? false });
  } catch (error) {
    console.error("GET /api/user/settings error", error);
    return NextResponse.json(
      { error: "Erro ao carregar configurações do usuário." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const userId = authUser.id;

    const body = await request.json().catch(() => null);
    const rawFlag = body?.useCloudflareProxy;

    if (typeof rawFlag !== "boolean") {
      return NextResponse.json(
        { error: "useCloudflareProxy deve ser boolean." },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { useCloudflareProxy: rawFlag },
      select: { useCloudflareProxy: true },
    });

    return NextResponse.json({ useCloudflareProxy: updated.useCloudflareProxy });
  } catch (error) {
    console.error("PATCH /api/user/settings error", error);
    return NextResponse.json(
      { error: "Erro ao atualizar configurações do usuário." },
      { status: 500 },
    );
  }
}
