import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/subscription";
import BrowseClient from "./BrowseClient";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const session: any = await getServerSession(authOptions);
  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === "ADMIN";

  // Verificar assinatura
  if (isLoggedIn && !isAdmin) {
    const userId = session?.user?.id;
    if (userId) {
      const hasAccess = await hasActiveSubscription(userId);
      if (!hasAccess) {
        redirect("/subscribe");
      }
    }
  }

  const titlesRaw = await prisma.title.findMany({
    orderBy: { popularity: "desc" },
    take: 48,
    select: {
      id: true,
      name: true,
      overview: true,
      posterUrl: true,
      backdropUrl: true,
      type: true,
      voteAverage: true,
      releaseDate: true,
      TitleGenre: {
        include: {
          Genre: true
        }
      }
    },
  });

  const titles = titlesRaw.map((t) => ({
    ...t,
    releaseDate: t.releaseDate ? t.releaseDate.toISOString() : null,
    genres: t.TitleGenre.map(tg => ({
      genre: {
        id: tg.Genre.id,
        name: tg.Genre.name
      }
    }))
  }));

  return <BrowseClient initialTitles={titles} isLoggedIn={isLoggedIn} isAdmin={isAdmin} />;
}
