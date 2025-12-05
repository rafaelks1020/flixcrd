import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import HomeClientNew2 from "./HomeClientNew2";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session: any = await getServerSession(authOptions);

  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === "ADMIN";

  // Buscar top 10 títulos populares para aleatorizar o hero
  const topTitles = await prisma.title.findMany({
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
    <HomeClientNew2
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      topTitles={topTitles}
      recentTitles={recentTitles}
    />
  );
}
