import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUser() {
  const session: any = await getServerSession(authOptions as any);

  if (!session || !session.user || !session.user.id) {
    return { userId: null };
  }

  return { userId: session.user.id as string };
}

export async function GET() {
  try {
    const { userId } = await requireUser();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

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
    const { userId } = await requireUser();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

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
