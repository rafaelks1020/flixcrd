import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    // Calcular data de início baseado no período
    const now = new Date();
    const startDate = new Date();
    const previousStartDate = new Date();
    
    if (period === "7d") {
      startDate.setDate(now.getDate() - 7);
      previousStartDate.setDate(now.getDate() - 14);
    } else if (period === "30d") {
      startDate.setDate(now.getDate() - 30);
      previousStartDate.setDate(now.getDate() - 60);
    } else if (period === "90d") {
      startDate.setDate(now.getDate() - 90);
      previousStartDate.setDate(now.getDate() - 180);
    }

    const [
      // Contagens gerais
      titlesCount,
      titlesWithHlsCount,
      usersCount,
      adminsCount,
      moviesCount,
      seriesCount,
      animesCount,
      episodesCount,
      
      // Títulos recentes
      recentTitles,
      
      // Novos usuários no período
      newUsersInPeriod,
      newUsersInPreviousPeriod,
      
      // Títulos adicionados no período
      titlesInPeriod,
      titlesInPreviousPeriod,
      
      // Solicitações
      totalRequests,
      pendingRequests,
      completedRequests,
      
      // Usuários pendentes de aprovação
      pendingApprovals,
      
      // Assinaturas ativas
      activeSubscriptions,
      
      // Top títulos por popularidade
      topTitles,
      
      // Uploads por dia (últimos 7 dias)
      titlesPerDay,
    ] = await Promise.all([
      // Contagens gerais
      prisma.title.count(),
      prisma.title.count({ where: { hlsPath: { not: null } } }),
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.title.count({ where: { type: "MOVIE" } }),
      prisma.title.count({ where: { type: "SERIES" } }),
      prisma.title.count({ where: { type: "ANIME" } }),
      prisma.episode.count(),
      
      // Títulos recentes
      prisma.title.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          posterUrl: true,
          createdAt: true,
        },
      }),
      
      // Novos usuários
      prisma.user.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: previousStartDate, lt: startDate },
        },
      }),
      
      // Títulos no período
      prisma.title.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.title.count({
        where: {
          createdAt: { gte: previousStartDate, lt: startDate },
        },
      }),
      
      // Solicitações
      prisma.request.count(),
      prisma.request.count({ where: { status: "PENDING" } }),
      prisma.request.count({ where: { status: "COMPLETED" } }),
      
      // Aprovações pendentes
      prisma.user.count({ where: { approvalStatus: "PENDING" } }),
      
      // Assinaturas ativas
      prisma.subscription.count({
        where: {
          status: "active",
          currentPeriodEnd: { gte: now },
        },
      }),
      
      // Top títulos por popularidade
      prisma.title.findMany({
        take: 5,
        orderBy: { popularity: "desc" },
        select: {
          id: true,
          name: true,
          popularity: true,
          posterUrl: true,
          type: true,
        },
      }),
      
      // Títulos recentes (últimos 7 dias) para calcular por dia
      prisma.title.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Calcular variações percentuais
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return NextResponse.json({
      // Contagens gerais
      titlesCount,
      titlesWithHlsCount,
      usersCount,
      adminsCount,
      moviesCount,
      seriesCount,
      animesCount,
      episodesCount,
      recentTitles,
      
      // Métricas do período
      period,
      newUsersInPeriod,
      newUsersChange: calcChange(newUsersInPeriod, newUsersInPreviousPeriod),
      titlesInPeriod,
      titlesChange: calcChange(titlesInPeriod, titlesInPreviousPeriod),
      
      // Solicitações
      totalRequests,
      pendingRequests,
      completedRequests,
      
      // Aprovações
      pendingApprovals,
      
      // Assinaturas
      activeSubscriptions,
      
      // Top títulos
      topTitles: topTitles.map((t: { id: string; name: string; popularity: number | null; posterUrl: string | null; type: string }, i: number) => ({
        ...t,
        rank: i + 1,
        score: Math.round(t.popularity || 0),
      })),
      
      // Gráfico de uploads - agrupar por dia
      uploadsPerDay: (() => {
        const grouped: Record<string, number> = {};
        (titlesPerDay || []).forEach((t: { createdAt: Date }) => {
          const dateKey = new Date(t.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          grouped[dateKey] = (grouped[dateKey] || 0) + 1;
        });
        return Object.entries(grouped).map(([date, count]) => ({ date, count })).slice(0, 7);
      })(),
    });
  } catch (error) {
    console.error("Erro ao buscar stats:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas" },
      { status: 500 }
    );
  }
}
