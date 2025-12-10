import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/subscription";
import TitleDetailClient from "./TitleDetailClient";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

function getYear(date: Date | null): string | null {
  if (!date) return null;
  return String(date.getFullYear());
}

function formatRuntime(runtime: number | null | undefined): string | null {
  if (!runtime || runtime <= 0) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

export default async function TitleDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session: any = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";

  // Verificar assinatura
  if (session && !isAdmin && userId) {
    const hasAccess = await hasActiveSubscription(userId);
    if (!hasAccess) {
      redirect("/subscribe");
    }
  }

  const title = await prisma.title.findUnique({
    where: { id },
    include: {
      genres: {
        include: { genre: true },
      },
      cast: {
        orderBy: { order: "asc" },
      },
      crew: true,
      videos: true,
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

  const isFavorite = false;

  const year = getYear(title.releaseDate as Date | null);
  const runtimeLabel = formatRuntime(title.runtime);

  const genres = (title.genres as any[])
    .map((tg) => tg.genre?.name as string | undefined)
    .filter(Boolean) as string[];

  let spokenLanguages: string[] = [];
  if (title.spokenLanguages) {
    try {
      const parsed = JSON.parse(title.spokenLanguages) as Array<{
        english_name?: string;
        name?: string;
      }>;
      spokenLanguages = parsed
        .map((l) => l.english_name || l.name)
        .filter(Boolean) as string[];
    } catch {
      spokenLanguages = [];
    }
  }

  let productionCountries: string[] = [];
  if (title.productionCountries) {
    try {
      const parsed = JSON.parse(title.productionCountries) as Array<{
        name?: string;
      }>;
      productionCountries = parsed.map((c) => c.name).filter(Boolean) as string[];
    } catch {
      productionCountries = [];
    }
  }

  const typeLabel =
    title.type === "MOVIE"
      ? "Filme"
      : title.type === "SERIES"
      ? "Série"
      : title.type === "ANIME"
      ? "Anime"
      : "Outro";

  const isSeries = title.type === "SERIES" || title.type === "ANIME";

  const mainCast = title.cast.slice(0, 12);
  const importantJobs = ["Director", "Writer", "Screenplay", "Producer"];
  const mainCrew = title.crew
    .filter((c: any) => importantJobs.includes(c.job))
    .slice(0, 10);

  const youtubeVideos = title.videos.filter((v: any) => v.site === "YouTube");

  let relatedTitles: { id: string; name: string; posterUrl: string | null }[] = [];
  let prevTitle: { id: string; name: string } | null = null;
  let nextTitle: { id: string; name: string } | null = null;

  const titleGenresAny = title.genres as any[];
  if (titleGenresAny.length > 0) {
    const primaryGenreId = titleGenresAny[0]?.genreId as string | undefined;
    if (primaryGenreId) {
      const genreTitles = await prisma.title.findMany({
        where: {
          genres: {
            some: { genreId: primaryGenreId },
          },
        },
        orderBy: { popularity: "desc" },
        take: 60,
        select: {
          id: true,
          name: true,
          posterUrl: true,
        },
      });

      const index = genreTitles.findIndex((g: any) => g.id === id);
      if (index > 0) {
        prevTitle = {
          id: genreTitles[index - 1].id,
          name: genreTitles[index - 1].name,
        };
      }
      if (index >= 0 && index < genreTitles.length - 1) {
        nextTitle = {
          id: genreTitles[index + 1].id,
          name: genreTitles[index + 1].name,
        };
      }

      relatedTitles = genreTitles.filter((g: any) => g.id !== id).slice(0, 16);
    }
  }

  const seasonsAny = (title as any).seasons as any[] | undefined;
  const seasonsForUi = Array.isArray(seasonsAny)
    ? [...seasonsAny].sort(
        (a, b) => (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0),
      )
    : [];

  let firstEpisode: {
    id: string;
    seasonNumber: number;
    episodeNumber: number;
    name: string;
  } | null = null;

  if (isSeries && seasonsForUi.length > 0) {
    for (const season of seasonsForUi) {
      if (Array.isArray(season.episodes) && season.episodes.length > 0) {
        const ep = season.episodes[0];
        firstEpisode = {
          id: ep.id as string,
          seasonNumber: ep.seasonNumber ?? season.seasonNumber ?? 0,
          episodeNumber: ep.episodeNumber ?? 0,
          name: ep.name as string,
        };
        break;
      }
    }
  }

  const isLoggedIn = !!session;

  return (
    <TitleDetailClient
      title={title}
      genres={genres}
      cast={mainCast}
      crew={mainCrew}
      seasons={seasonsForUi}
      similarTitles={relatedTitles}
      videos={youtubeVideos}
      isFavorite={isFavorite}
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
    />
  );
}
