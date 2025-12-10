import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
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
