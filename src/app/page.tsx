import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/subscription";
import HomeClient from "./HomeClient";
import LandingPage from "@/components/LandingPage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session: any = await getServerSession(authOptions);

  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === "ADMIN";
  const approvalStatus = session?.user?.approvalStatus;

  // Se não está logado, mostrar landing page
  if (!isLoggedIn) {
    return <LandingPage />;
  }

  // Se está logado mas não é admin, verificar aprovação e assinatura
  if (!isAdmin) {
    // Primeiro verificar se foi aprovado
    if (approvalStatus !== "APPROVED") {
      redirect("/pending-approval");
    }

    // Depois verificar assinatura
    const userId = session?.user?.id;
    if (userId) {
      const hasAccess = await hasActiveSubscription(userId);
      if (!hasAccess) {
        redirect("/subscribe");
      }
    }
  }

  // Buscar top 10 títulos populares para aleatorizar o hero
  // Só o que está 100% pronto para tocar aparece no catálogo.
  const topTitles = await prisma.title.findMany({
    where: { hlsReady: true },
    orderBy: { popularity: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      overview: true,
      backdropUrl: true,
      posterUrl: true,
      releaseDate: true,
      voteAverage: true,
      type: true,
      createdAt: true,
    },
  });

  // Buscar títulos recentes (últimos 30 dias)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentTitles = await prisma.title.findMany({
    where: {
      hlsReady: true,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      posterUrl: true,
      backdropUrl: true,
      type: true,
      voteAverage: true,
      createdAt: true,
    },
  });

  return (
    <HomeClient
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      topTitles={topTitles}
      recentTitles={recentTitles}
    />
  );
}
