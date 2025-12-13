import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

interface SessionUser {
  id?: string;
  email?: string;
  name?: string | null;
  role?: string;
}

interface AdminSession {
  user?: SessionUser;
}

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AdminSession | null;

    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const url = new URL(request.url);

    const q = (url.searchParams.get("q") || "").trim();
    const userId = (url.searchParams.get("userId") || "").trim();
    const status = (url.searchParams.get("status") || "").trim();
    const billingType = (url.searchParams.get("billingType") || "").trim();

    const pageParam = Number(url.searchParams.get("page") || "1");
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

    const pageSizeParam = Number(url.searchParams.get("pageSize") || "50");
    const pageSize =
      Number.isFinite(pageSizeParam) && pageSizeParam > 0 && pageSizeParam <= 200
        ? Math.floor(pageSizeParam)
        : 50;

    const fromParam = (url.searchParams.get("from") || "").trim();
    const toParam = (url.searchParams.get("to") || "").trim();

    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate = toParam ? new Date(toParam) : null;

    const and: any[] = [];

    if (status) {
      and.push({ status });
    }

    if (billingType) {
      and.push({ billingType });
    }

    if (userId) {
      and.push({ Subscription: { is: { userId } } });
    }

    if (fromDate && Number.isFinite(fromDate.getTime())) {
      and.push({ createdAt: { gte: fromDate } });
    }

    if (toDate && Number.isFinite(toDate.getTime())) {
      and.push({ createdAt: { lte: toDate } });
    }

    if (q) {
      and.push({
        OR: [
          { asaasPaymentId: { contains: q, mode: "insensitive" } },
          { Subscription: { is: { userId: { contains: q, mode: "insensitive" } } } },
          { Subscription: { is: { User: { is: { email: { contains: q, mode: "insensitive" } } } } } },
          { Subscription: { is: { User: { is: { name: { contains: q, mode: "insensitive" } } } } } },
        ],
      });
    }

    const where = and.length ? { AND: and } : {};

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
          Subscription: {
            select: {
              id: true,
              userId: true,
              status: true,
              plan: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
              price: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const pages = total ? Math.max(1, Math.ceil(total / pageSize)) : 1;

    const origin = request.nextUrl.origin;

    const items = payments.map((p) => ({
      id: p.id,
      asaasPaymentId: p.asaasPaymentId,
      status: p.status,
      value: p.value,
      billingType: p.billingType,
      dueDate: p.dueDate.toISOString(),
      paymentDate: p.paymentDate ? p.paymentDate.toISOString() : null,
      invoiceUrl: p.invoiceUrl ? `${origin}/api/payments/${p.id}/invoice` : null,
      pixQrCode: p.pixQrCode ?? null,
      pixCopiaECola: p.pixCopiaECola ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      subscription: {
        id: p.Subscription.id,
        userId: p.Subscription.userId,
        status: p.Subscription.status,
        plan: p.Subscription.plan,
        currentPeriodStart: p.Subscription.currentPeriodStart
          ? p.Subscription.currentPeriodStart.toISOString()
          : null,
        currentPeriodEnd: p.Subscription.currentPeriodEnd
          ? p.Subscription.currentPeriodEnd.toISOString()
          : null,
        price: p.Subscription.price,
        user: {
          id: p.Subscription.User.id,
          email: p.Subscription.User.email,
          name: p.Subscription.User.name,
        },
      },
    }));

    return NextResponse.json({
      page,
      pageSize,
      total,
      pages,
      items,
    });
  } catch (error) {
    console.error("GET /api/admin/payments error", error);
    return NextResponse.json(
      { error: "Erro ao carregar pagamentos." },
      { status: 500 },
    );
  }
}
