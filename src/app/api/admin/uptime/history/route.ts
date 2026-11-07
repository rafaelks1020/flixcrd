import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminDenied } from "@/lib/require-admin";

export async function GET(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;

  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(
      Math.max(parseInt(limitParam ?? "24", 10) || 24, 1),
      168,
    );

    const snapshots = await prisma.serviceStatusSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      data: snapshots,
      count: snapshots.length,
    });
  } catch (error) {
    console.error("Erro ao buscar histórico de uptime:", error);
    return NextResponse.json(
      { error: "Erro ao buscar histórico de uptime" },
      { status: 500 },
    );
  }
}
