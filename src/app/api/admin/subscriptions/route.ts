import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Listar todas as assinaturas
export async function GET() {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error("Erro ao buscar assinaturas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar assinaturas" },
      { status: 500 }
    );
  }
}

// Criar ou atualizar assinatura
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, status, plan, price, currentPeriodStart, currentPeriodEnd } = body;

    if (!userId || !status) {
      return NextResponse.json(
        { error: "userId e status são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se já existe assinatura
    const existing = await prisma.subscription.findUnique({
      where: { userId },
    });

    let subscription;

    if (existing) {
      // Atualizar
      subscription = await prisma.subscription.update({
        where: { userId },
        data: {
          status,
          plan: plan || existing.plan,
          price: price || existing.price,
          currentPeriodStart: currentPeriodStart
            ? new Date(currentPeriodStart)
            : undefined,
          currentPeriodEnd: currentPeriodEnd
            ? new Date(currentPeriodEnd)
            : undefined,
        },
      });
    } else {
      // Criar
      subscription = await prisma.subscription.create({
        data: {
          userId,
          status,
          plan: plan || "BASIC",
          price: price || 10.00,
          currentPeriodStart: currentPeriodStart
            ? new Date(currentPeriodStart)
            : undefined,
          currentPeriodEnd: currentPeriodEnd
            ? new Date(currentPeriodEnd)
            : undefined,
        },
      });
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("Erro ao criar/atualizar assinatura:", error);
    return NextResponse.json(
      { error: "Erro ao processar assinatura" },
      { status: 500 }
    );
  }
}
