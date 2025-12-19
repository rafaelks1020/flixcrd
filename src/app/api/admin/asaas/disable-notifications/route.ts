import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { disableCustomerNotifications } from "@/lib/asaas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({} as any));
    const {
      customerId,
      userId,
      limit = 50,
      offset = 0,
    }: {
      customerId?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    } = body;

    const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = Math.max(Number(offset) || 0, 0);

    let customerIds: string[] = [];

    if (customerId) {
      customerIds = [customerId];
    } else if (userId) {
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { asaasCustomerId: true },
      });

      if (subscription?.asaasCustomerId) {
        customerIds = [subscription.asaasCustomerId];
      }
    } else {
      const subscriptions = await prisma.subscription.findMany({
        where: { asaasCustomerId: { not: null } },
        select: { asaasCustomerId: true },
        distinct: ["asaasCustomerId"],
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      });

      customerIds = subscriptions
        .map((s) => s.asaasCustomerId)
        .filter((id): id is string => Boolean(id));
    }

    const results: Array<{ customerId: string; ok: boolean; error?: string }> = [];

    for (const id of customerIds) {
      try {
        await disableCustomerNotifications(id);
        results.push({ customerId: id, ok: true });
      } catch (error: any) {
        results.push({
          customerId: id,
          ok: false,
          error: error?.message || "Erro ao desativar notificações",
        });
      }
    }

    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;

    return NextResponse.json({
      processed: results.length,
      ok,
      failed,
      page: { offset: skip, limit: pageSize },
      results,
    });
  } catch (error) {
    console.error("POST /api/admin/asaas/disable-notifications error", error);
    return NextResponse.json(
      { error: "Erro ao desativar notificações do Asaas" },
      { status: 500 },
    );
  }
}
