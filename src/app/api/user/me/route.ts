import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";

function getUserFromToken(request: NextRequest) {
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
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
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
