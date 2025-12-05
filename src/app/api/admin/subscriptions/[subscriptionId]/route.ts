import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Atualizar assinatura específica
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;
    const body = await request.json();
    const { status, plan, currentPeriodStart, currentPeriodEnd } = body;

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status,
        plan,
        currentPeriodStart: currentPeriodStart
          ? new Date(currentPeriodStart)
          : undefined,
        currentPeriodEnd: currentPeriodEnd
          ? new Date(currentPeriodEnd)
          : undefined,
      },
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("Erro ao atualizar assinatura:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar assinatura" },
      { status: 500 }
    );
  }
}

// Deletar assinatura
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;

    await prisma.subscription.delete({
      where: { id: subscriptionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar assinatura:", error);
    return NextResponse.json(
      { error: "Erro ao deletar assinatura" },
      { status: 500 }
    );
  }
}
