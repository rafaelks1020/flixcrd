import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PaymentsClient from "./PaymentsClient";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const session: any = await getServerSession(authOptions as any);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "ADMIN";

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id as string },
    select: {
      id: true,
      status: true,
      plan: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      price: true,
    },
  });

  let payments: Array<{
    id: string;
    asaasPaymentId: string;
    status: string;
    value: number;
    billingType: string;
    dueDate: string;
    paymentDate: string | null;
    invoiceUrl: string | null;
    pixQrCode: string | null;
    pixCopiaECola: string | null;
    createdAt: string;
  }> = [];

  if (subscription?.id) {
    const raw = await prisma.payment.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: "desc" },
      take: 200,
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
      },
    });

    payments = raw.map((p) => ({
      ...p,
      dueDate: p.dueDate.toISOString(),
      paymentDate: p.paymentDate ? p.paymentDate.toISOString() : null,
      invoiceUrl: p.invoiceUrl ? `/api/payments/${p.id}/invoice` : null,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  return (
    <PaymentsClient
      isLoggedIn={true}
      isAdmin={isAdmin}
      subscription={
        subscription
          ? {
              ...subscription,
              currentPeriodStart: subscription.currentPeriodStart
                ? subscription.currentPeriodStart.toISOString()
                : null,
              currentPeriodEnd: subscription.currentPeriodEnd
                ? subscription.currentPeriodEnd.toISOString()
                : null,
            }
          : null
      }
      payments={payments}
    />
  );
}
