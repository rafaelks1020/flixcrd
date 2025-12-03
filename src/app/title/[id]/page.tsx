import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import FavoriteButton from "./FavoriteButton";

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

  let isFavorite = false;

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

  return (
    <main className="min-h-screen bg-black text-zinc-50">
      <div className="relative min-h-screen bg-black">
        {title.backdropUrl && (
          <div className="pointer-events-none absolute inset-0">
            <img
              src={title.backdropUrl}
              alt={title.name}
              className="h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/40" />
          </div>
        )}

        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="flex items-center justify-between px-4 py-4 text-sm text-zinc-200 md:px-10">
            <Link href="/" className="font-semibold tracking-tight">
              PaelFlix
            </Link>
            <Link
              href="/"
              className="rounded-full border border-zinc-500/70 px-3 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-800/80"
            >
              Voltar para início
            </Link>
          </header>

          <section className="flex flex-1 flex-col items-center px-4 pb-10 pt-2 md:flex-row md:items-stretch md:px-10 md:pb-16 md:pt-4">
            <div className="mb-6 w-full max-w-xs md:mb-0 md:w-auto md:max-w-sm">
              {title.posterUrl ? (
                <div className="overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900/80 shadow-2xl">
                  <img
                    src={title.posterUrl}
                    alt={title.name}
                    className="aspect-[2/3] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[2/3] items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-900/80 text-center text-sm text-zinc-300 shadow-2xl">
                  {title.name}
                </div>
              )}
            </div>

            <div className="w-full max-w-2xl space-y-4 md:ml-10">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold md:text-3xl">
                  {title.name}
                  {year && <span className="ml-2 text-zinc-300">({year})</span>}
                </h1>
                {title.originalName && title.originalName !== title.name && (
                  <p className="text-sm text-zinc-400">{title.originalName}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
                  <span className="uppercase tracking-wide text-zinc-400">{typeLabel}</span>
                  {runtimeLabel && <span>• {runtimeLabel}</span>}
                  {title.voteAverage !== null && title.voteAverage !== undefined && (
                    <span className="flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      {title.voteAverage.toFixed(1)}
                    </span>
                  )}
                  {genres.length > 0 && (
                    <span className="hidden text-zinc-300 md:inline">• {genres.join(" • ")}</span>
                  )}
                </div>
                {title.tagline && (
                  <p className="text-sm italic text-zinc-300">“{title.tagline}”</p>
                )}
              </div>

              <div className="text-sm leading-relaxed text-zinc-100">
                {title.overview || "Sem sinopse cadastrada para este título."}
              </div>

              <div className="flex flex-wrap gap-6 text-xs text-zinc-300">
                {genres.length > 0 && (
                  <div>
                    <p className="font-semibold text-zinc-200">Gêneros</p>
                    <p>{genres.join(", ")}</p>
                  </div>
                )}
                {spokenLanguages.length > 0 && (
                  <div>
                    <p className="font-semibold text-zinc-200">Idiomas</p>
                    <p>{spokenLanguages.join(", ")}</p>
                  </div>
                )}
                {productionCountries.length > 0 && (
                  <div>
                    <p className="font-semibold text-zinc-200">Países</p>
                    <p>{productionCountries.join(", ")}</p>
                  </div>
                )}
                {title.status && (
                  <div>
                    <p className="font-semibold text-zinc-200">Status</p>
                    <p>{title.status}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Link
                  href={
                    isSeries && firstEpisode
                      ? `/watch/${title.id}?episodeId=${firstEpisode.id}`
                      : `/watch/${title.id}`
                  }
                  className="rounded-md bg-zinc-50 px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
                >
                  Assistir agora
                </Link>

                <Link
                  href="/"
                  className="rounded-md border border-zinc-600/80 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800/80"
                >
                  Voltar para início
                </Link>

                {userId && (
                  <FavoriteButton
                    titleId={title.id}
                    initialIsFavorite={isFavorite}
                  />
                )}

                {prevTitle && (
                  <Link
                    href={`/title/${prevTitle.id}`}
                    className="rounded-md border border-zinc-600/80 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800/80"
                  >
                    ← Anterior
                  </Link>
                )}
                {nextTitle && (
                  <Link
                    href={`/title/${nextTitle.id}`}
                    className="rounded-md border border-zinc-600/80 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800/80"
                  >
                    Próximo →
                  </Link>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {isSeries && seasonsForUi.length > 0 && (
        <section className="px-4 pb-8 pt-4 md:px-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Temporadas e episódios
          </h2>
          <div className="space-y-4 text-xs">
            {seasonsForUi.map((season: any) => (
              <div
                key={season.id ?? season.seasonNumber}
                className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">
                      T{String(season.seasonNumber ?? 0).padStart(2, "0")} – {season.name || "Sem título"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-400">
                      {(season.episodeCount ??
                        (Array.isArray(season.episodes) ? season.episodes.length : 0)) || 0}{" "}
                      episódio(s)
                    </div>
                  </div>
                </div>

                {Array.isArray(season.episodes) && season.episodes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {season.episodes.map((ep: any) => (
                      <div
                        key={ep.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-2"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[11px] font-semibold text-zinc-50">
                                S{String(ep.seasonNumber ?? season.seasonNumber ?? 0).padStart(2, "0")}E
                                {String(ep.episodeNumber ?? 0).padStart(2, "0")} – {ep.name}
                              </div>
                            </div>
                            <Link
                              href={`/watch/${title.id}?episodeId=${ep.id}`}
                              className="rounded-md bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-900 hover:bg-white"
                            >
                              Assistir
                            </Link>
                          </div>
                          {ep.overview && (
                            <p className="line-clamp-2 text-[11px] text-zinc-300">
                              {ep.overview}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Elenco principal */}
      {mainCast.length > 0 && (
        <section className="px-4 pb-8 pt-4 md:px-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Elenco principal
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {mainCast.map((person: any) => (
              <div
                key={person.id}
                className="w-28 flex-shrink-0 text-xs text-zinc-200"
              >
                <div className="mb-1 overflow-hidden rounded-md bg-zinc-800">
                  {person.profilePath ? (
                    <img
                      src={person.profilePath}
                      alt={person.name}
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center px-2 text-center text-[11px] text-zinc-400">
                      {person.name}
                    </div>
                  )}
                </div>
                <div className="line-clamp-2 font-semibold">{person.name}</div>
                {person.character && (
                  <div className="line-clamp-2 text-[11px] text-zinc-400">
                    como {person.character}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Equipe técnica */}
      {mainCrew.length > 0 && (
        <section className="px-4 pb-8 pt-2 md:px-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Equipe
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {mainCrew.map((person: any) => (
              <div
                key={person.id}
                className="w-36 flex-shrink-0 text-xs text-zinc-200"
              >
                <div className="mb-1 overflow-hidden rounded-md bg-zinc-800">
                  {person.profilePath ? (
                    <img
                      src={person.profilePath}
                      alt={person.name}
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center px-2 text-center text-[11px] text-zinc-400">
                      {person.name}
                    </div>
                  )}
                </div>
                <div className="line-clamp-2 font-semibold">{person.name}</div>
                <div className="text-[11px] text-zinc-400">{person.job}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mais títulos para assistir */}
      {relatedTitles.length > 0 && (
        <section className="px-4 pb-10 pt-2 md:px-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Mais títulos semelhantes
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {relatedTitles.map((other) => (
              <Link
                key={other.id}
                href={`/title/${other.id}`}
                className="group relative min-w-[140px] flex-shrink-0 overflow-hidden rounded-md bg-zinc-900 transition hover:scale-105 hover:z-10 md:min-w-[180px]"
              >
                {other.posterUrl ? (
                  <img
                    src={other.posterUrl}
                    alt={other.name}
                    className="aspect-[2/3] w-full object-cover transition group-hover:opacity-80"
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-800 text-center text-xs text-zinc-400">
                    {other.name}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[11px] leading-tight">
                  <div className="line-clamp-2 font-semibold text-zinc-50">
                    {other.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trailers / vídeos */}
      {youtubeVideos.length > 0 && (
        <section className="px-4 pb-12 pt-2 md:px-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Trailers e vídeos
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {youtubeVideos.map((video: any) => (
              <a
                key={video.id}
                href={`https://www.youtube.com/watch?v=${video.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-64 flex-shrink-0 overflow-hidden rounded-md bg-zinc-900"
              >
                <div className="relative h-36 w-full">
                  <img
                    src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                    alt={video.name}
                    className="h-full w-full object-cover transition group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-lg text-zinc-50">
                      ▶
                    </span>
                  </div>
                </div>
                <div className="p-2 text-xs leading-tight text-zinc-100">
                  <div className="line-clamp-2 font-semibold">{video.name}</div>
                  <div className="text-[11px] text-zinc-400">{video.type}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
