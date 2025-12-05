import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import TitleDetailClient from "./TitleDetailClient";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TitleDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session: any = await getServerSession(authOptions);
  
  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === "ADMIN";
  const userId = session?.user?.id;

  // Buscar título com todas as relações
  const title = await prisma.title.findUnique({
    where: { id },
    include: {
      genres: {
        include: { genre: true },
      },
      cast: {
        orderBy: { order: "asc" },
        take: 20,
      },
      seasons: {
        orderBy: { seasonNumber: "asc" },
        include: {
          episodes: {
            orderBy: { episodeNumber: "asc" },
          },
        },
      },
    },
  });

  if (!title) {
    notFound();
  }

  // Buscar títulos similares (mesmo gênero)
  const genreIds = title.genres.map((tg: any) => tg.genreId);
  const similarTitles = genreIds.length > 0
    ? await prisma.title.findMany({
        where: {
          id: { not: id },
          genres: {
            some: {
              genreId: { in: genreIds },
            },
          },
        },
        take: 12,
        orderBy: { popularity: "desc" },
        select: {
          id: true,
          name: true,
          posterUrl: true,
          backdropUrl: true,
          type: true,
          voteAverage: true,
          releaseDate: true,
        },
      })
    : [];

  // Verificar se é favorito
  let isFavorite = false;
  let profileId: string | null = null;

  if (isLoggedIn && typeof window === "undefined") {
    // Server-side: não temos acesso ao localStorage
    // O client component vai verificar
  }

  // Formatar dados
  const genres = title.genres.map((tg: any) => ({
    id: tg.genre.id,
    name: tg.genre.name,
  }));

  const cast = title.cast.map((c: any) => ({
    id: c.id,
    name: c.name,
    character: c.character || "",
    profilePath: c.profilePath,
  }));

  const seasons = title.seasons.map((s: any) => ({
    id: s.id,
    seasonNumber: s.seasonNumber,
    name: s.name || `Temporada ${s.seasonNumber}`,
    episodes: s.episodes.map((e: any) => ({
      id: e.id,
      episodeNumber: e.episodeNumber,
      name: e.name || `Episódio ${e.episodeNumber}`,
      overview: e.overview,
      stillPath: e.stillPath,
      runtime: e.runtime,
    })),
  }));

  return (
    <TitleDetailClient
      title={title}
      genres={genres}
      cast={cast}
      seasons={seasons}
      similarTitles={similarTitles}
      isFavorite={isFavorite}
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      profileId={profileId}
    />
  );
}
