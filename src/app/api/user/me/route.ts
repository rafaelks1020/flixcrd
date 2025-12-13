import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.NEXTAUTH_SECRET;

function getUserFromToken(request: NextRequest) {
  if (!JWT_SECRET) {
    return null;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string; role: string };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!JWT_SECRET) {
    return NextResponse.json(
      { error: "NEXTAUTH_SECRET não configurado" },
      { status: 500 },
    );
  }

  const tokenUser = getUserFromToken(request);

  if (!tokenUser) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenUser.id },
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
      { error: "Usuário não encontrado" },
      { status: 404 }
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
  if (!JWT_SECRET) {
    return NextResponse.json(
      { error: "NEXTAUTH_SECRET não configurado" },
      { status: 500 },
    );
  }

  const tokenUser = getUserFromToken(request);

  if (!tokenUser) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const data = await request.json();

  const user = await prisma.user.update({
    where: { id: tokenUser.id },
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
