import { prisma } from "@/lib/prisma";
import BrowseClient from "./BrowseClient";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const titles = await prisma.title.findMany({
    orderBy: { popularity: "desc" },
    take: 48,
    select: {
      id: true,
      name: true,
      posterUrl: true,
      type: true,
      voteAverage: true,
    },
  });

  return (
    <main className="min-h-screen bg-black text-zinc-50">
      <BrowseClient initialTitles={titles} />
    </main>
  );
}
