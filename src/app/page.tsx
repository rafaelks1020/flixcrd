import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session: any = await getServerSession(authOptions);

  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === "ADMIN";

  // Buscar título hero (mais popular ou mais recente)
  const heroTitle = await prisma.title.findFirst({
    orderBy: { popularity: "desc" },
    select: {
      id: true,
      name: true,
      overview: true,
      backdropUrl: true,
      releaseDate: true,
      voteAverage: true,
    },
  });

  return (
    <HomeClient
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      heroTitle={heroTitle}
    />
  );
}
