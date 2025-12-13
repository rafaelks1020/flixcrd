import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 50;
    const take = Number.isFinite(limit) && limit > 0 && limit <= 200 ? Math.floor(limit) : 50;

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        status: true,
        plan: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        price: true,
      },
    });

    if (!subscription) {
      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
        payments: [],
      });
    }

    const payments = await prisma.payment.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        asaasPaymentId: true,
        status: true,
        value: true,
        billingType: true,
        dueDate: true,
        paymentDate: true,
        invoiceUrl: true,
        pixQrCode: true,
        pixCopiaECola: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const origin = request.nextUrl.origin;
    const items = payments.map((p) => ({
      ...p,
      invoiceUrl: p.invoiceUrl ? `${origin}/api/payments/${p.id}/invoice` : null,
    }));

    return NextResponse.json({
      hasSubscription: true,
      subscription,
      payments: items,
    });
  } catch (error) {
    console.error("GET /api/payments error", error);
    return NextResponse.json(
      { error: "Erro ao carregar histórico de pagamentos." },
      { status: 500 },
    );
  }
}
