import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailStatus, isEmailStatus } from "@/types/email";

async function requireAdmin() {
  const session: any = await getServerSession(authOptions as any);

  if (!session || !session.user || (session.user as any).role !== "ADMIN") {
    return { isAdmin: false };
  }

  return { isAdmin: true };
}

export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limitRaw = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 200);
    const statusParam = searchParams.get("status");
    const reason = searchParams.get("reason") || undefined;
    const search = searchParams.get("search") || undefined;

    const where: any = {};

    if (statusParam && isEmailStatus(statusParam)) {
      where.status = statusParam as EmailStatus;
    }

    if (reason) {
      where.reason = { contains: reason, mode: "insensitive" };
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { to: { contains: search, mode: "insensitive" } },
        { errorMessage: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await prisma.$transaction([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailLog.count({ where }),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return NextResponse.json({
      data,
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    console.error("GET /api/admin/email-logs error", error);
    return NextResponse.json(
      { error: "Erro ao carregar logs de email." },
      { status: 500 },
    );
  }
}