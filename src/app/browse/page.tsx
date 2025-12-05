import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import BrowseClient from "./BrowseClient";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const session: any = await getServerSession(authOptions);
  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === "ADMIN";

  const titlesRaw = await prisma.title.findMany({
    orderBy: { popularity: "desc" },
    take: 48,
    select: {
      id: true,
      name: true,
      posterUrl: true,
      backdropUrl: true,
      type: true,
      voteAverage: true,
      releaseDate: true,
    },
  });

  const titles = titlesRaw.map((t) => ({
    ...t,
    releaseDate: t.releaseDate ? t.releaseDate.toISOString() : null,
  }));

  return <BrowseClient initialTitles={titles} isLoggedIn={isLoggedIn} isAdmin={isAdmin} />;
}
