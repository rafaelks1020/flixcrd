import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [
      recentTitles,
      recentRequests,
      recentUsers,
      pendingApprovals,
      pendingRequests,
    ] = await Promise.all([
      // Últimos 20 títulos adicionados
      prisma.title.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          createdAt: true,
        },
      }),
      
      // Últimas 20 solicitações
      prisma.request.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
      }),
      
      // Últimos 20 usuários
      prisma.user.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      }),
      
      // Contagem de aprovações pendentes
      prisma.user.count({
        where: { approvalStatus: "PENDING" },
      }),
      
      // Contagem de solicitações pendentes
      prisma.request.count({
        where: { status: "PENDING" },
      }),
    ]);

    return NextResponse.json({
      recentTitles,
      recentRequests,
      recentUsers,
      pendingApprovals,
      pendingRequests,
    });
  } catch (error) {
    console.error("Erro ao buscar logs:", error);
    return NextResponse.json(
      { error: "Erro ao buscar atividades" },
      { status: 500 }
    );
  }
}
