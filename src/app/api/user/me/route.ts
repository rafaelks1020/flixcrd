import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);

  if (!authUser) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      Subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const now = new Date();
  const sub = user.Subscription;
  const isActive = Boolean(
    sub && sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd > now,
  );

  const subscriptionStatus = isActive
    ? "ACTIVE"
    : sub?.status === "PENDING"
      ? "PENDING"
      : sub?.status === "CANCELED"
        ? "CANCELLED"
        : "INACTIVE";

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    subscriptionStatus,
    subscriptionEndDate: sub?.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : undefined,
  });
}

export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);

  if (!authUser) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const data = await request.json();

  const user = await prisma.user.update({
    where: { id: authUser.id },
    data: {
      name: data.name,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  return NextResponse.json(user);
}
