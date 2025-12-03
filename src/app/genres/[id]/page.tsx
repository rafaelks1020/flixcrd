import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import GenreCarouselClient from "./GenreCarouselClient";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function GenreBrowsePage({ params }: PageProps) {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    notFound();
  }

  const genre = await prisma.genre.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
    },
  });

  if (!genre) {
    notFound();
  }

  const titles = await prisma.title.findMany({
    where: {
      genres: {
        some: { genreId: genre.id },
      },
    },
    orderBy: { popularity: "desc" },
    take: 80,
    select: {
      id: true,
      name: true,
      posterUrl: true,
    },
  });

  return (
    <main className="min-h-screen bg-black text-zinc-50">
      <GenreCarouselClient genreName={genre.name} titles={titles} />
    </main>
  );
}
