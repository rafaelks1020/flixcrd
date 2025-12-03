"use client";

import type React from "react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Genre {
  id: string;
  name: string;
  tmdbId: number;
}

interface Title {
  id: string;
  name: string;
  slug: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  releaseDate: string | null;
  type: string;
}

interface ContinueWatchingItem extends Title {
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  episodeId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeName: string | null;
}

interface HomeClientProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  heroTitle: {
    id: string;
    name: string;
    overview: string | null;
    backdropUrl: string | null;
    releaseDate: Date | string | null;
    voteAverage: number | null;
  } | null;
}

export default function HomeClient({ isLoggedIn, isAdmin, heroTitle }: HomeClientProps) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [titlesByGenre, setTitlesByGenre] = useState<Record<string, Title[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Title[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [favorites, setFavorites] = useState<Title[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Carregar perfil ativo do localStorage
  useEffect(() => {
    if (isLoggedIn && typeof window !== "undefined") {
      const profileId = localStorage.getItem("activeProfileId");
      if (profileId) {
        setActiveProfileId(profileId);
      } else {
        // Se não tem perfil ativo, redirecionar para seleção de perfil
        window.location.href = "/profiles";
      }
    }
  }, [isLoggedIn]);

  useEffect(() => {
    async function loadGenresAndTitles() {
      try {
        const genresRes = await fetch("/api/genres");
        const genresData: Genre[] = await genresRes.json();
        setGenres(genresData);

        // Carrega títulos de todos os gêneros em paralelo
        const genresToLoad = genresData.slice(0, 6);
        const titlesPromises = genresToLoad.map(async (genre) => {
          const titlesRes = await fetch(`/api/genres/${genre.id}/titles`);
          const titlesData: Title[] = await titlesRes.json();
          return { genreId: genre.id, titles: titlesData };
        });

        const titlesResults = await Promise.all(titlesPromises);
        const titlesMap: Record<string, Title[]> = {};
        for (const result of titlesResults) {
          titlesMap[result.genreId] = result.titles;
        }
        setTitlesByGenre(titlesMap);

        if (isLoggedIn && activeProfileId) {
          // Carrega favoritos e continuar assistindo em paralelo
          const [favResult, cwResult] = await Promise.allSettled([
            fetch(`/api/user/favorites?profileId=${activeProfileId}`).then((res) =>
              res.ok ? res.json() : []
            ),
            fetch(`/api/user/continue-watching?profileId=${activeProfileId}`).then((res) =>
              res.ok ? res.json() : []
            ),
          ]);

          setFavorites(
            favResult.status === "fulfilled" ? favResult.value : []
          );
          setContinueWatching(
            cwResult.status === "fulfilled" ? cwResult.value : []
          );
        } else {
          setFavorites([]);
          setContinueWatching([]);
        }
      } catch (err) {
        console.error("Erro ao carregar gêneros/títulos", err);
      } finally {
        setLoading(false);
      }
    }

    if (isLoggedIn && !activeProfileId) {
      // Aguardar perfil ser carregado
      return;
    }

    loadGenresAndTitles();
  }, [isLoggedIn, activeProfileId]);

  let heroYear: number | null = null;
  if (heroTitle?.releaseDate) {
    const dateValue =
      typeof heroTitle.releaseDate === "string"
        ? new Date(heroTitle.releaseDate)
        : heroTitle.releaseDate;
    heroYear = Number.isNaN(dateValue.getTime()) ? null : dateValue.getFullYear();
  }

  // Limpa timeout pendente ao desmontar
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  async function fetchSearch(value: string) {
    try {
      const url = new URL("/api/titles", window.location.origin);
      url.searchParams.set("q", value.trim());
      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao buscar títulos");
      }
      setSearchResults(data as Title[]);
    } catch (err) {
      console.error("Erro na busca de títulos", err);
      setSearchResults([]);
    }
  }

  function handleSearchChange(event: any) {
    const value = event.target.value as string;
    setSearch(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      await fetchSearch(value);
      setSearchLoading(false);
    }, 400);
  }

  const hasSearch = search.trim().length > 0;

  function scrollGenreRow(genreId: string, direction: "left" | "right") {
    const el = rowRefs.current[genreId];
    if (!el) return;
    const amount = el.clientWidth * 0.8 || 400;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <main className="min-h-screen bg-black text-zinc-50">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] overflow-hidden bg-black">
        {heroTitle?.backdropUrl && (
          <div className="absolute inset-0">
            <img
              src={heroTitle.backdropUrl}
              alt={heroTitle.name}
              className="h-full w-full object-cover opacity-50"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          </div>
        )}

        <div className="relative z-10 flex min-h-[85vh] flex-col">
          {/* Header */}
          <header className="flex flex-col gap-3 px-4 py-4 text-sm text-zinc-200 md:flex-row md:items-center md:justify-between md:px-10">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight text-red-600">
                PaelFlix
              </span>
            </div>
            <div className="flex flex-1 items-center gap-3 md:justify-end">
              {/* Busca no topo */}
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Buscar por título..."
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-400 md:text-sm"
                />
              </div>
              {isLoggedIn && (
                <>
                  <Link
                    href="/browse"
                    className="hidden rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800 md:inline-block"
                  >
                    Catálogo
                  </Link>
                  <Link
                    href="/profiles"
                    className="rounded-full border-2 border-zinc-600 p-1.5 text-lg hover:border-zinc-400"
                    title="Trocar perfil"
                  >
                    👤
                  </Link>
                </>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800 md:inline-block"
                >
                  Admin
                </Link>
              )}
              {!isLoggedIn ? (
                <Link
                  href="/login"
                  className="rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 md:text-sm"
                >
                  Entrar
                </Link>
              ) : (
                <Link
                  href="/api/auth/signout"
                  className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
                >
                  Sair
                </Link>
              )}
            </div>
          </header>

          {/* Hero Content */}
          <div className="flex flex-1 items-center px-4 pb-16 pt-8 md:px-10">
            <div className="max-w-2xl space-y-4">
              {heroTitle && (
                <>
                  <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-2xl md:text-6xl">
                    {heroTitle.name}
                  </h1>
                  {heroYear && (
                    <div className="flex items-center gap-3 text-sm text-zinc-300">
                      <span>{heroYear}</span>
                      {heroTitle.voteAverage && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <span className="text-yellow-400">★</span>
                            {heroTitle.voteAverage.toFixed(1)}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  {heroTitle.overview && (
                    <p className="line-clamp-3 text-sm text-zinc-200 md:text-base">
                      {heroTitle.overview}
                    </p>
                  )}
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    {isLoggedIn ? (
                      <>
                        <Link
                          href={`/title/${heroTitle.id}`}
                          className="flex items-center justify-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-bold text-black hover:bg-zinc-200"
                        >
                          <span>▶</span>
                          Assistir
                        </Link>
                        <Link
                          href={`/title/${heroTitle.id}`}
                          className="flex items-center justify-center gap-2 rounded-md bg-zinc-700/80 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-600/80"
                        >
                          <span>ⓘ</span>
                          Mais informações
                        </Link>
                      </>
                    ) : (
                      <Link
                        href="/login"
                        className="flex items-center justify-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700"
                      >
                        Entrar para assistir
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Continuar assistindo */}
      {isLoggedIn && !hasSearch && continueWatching.length > 0 && (
        <section className="space-y-3 px-4 pb-4 pt-6 md:px-10">
          <h2 className="text-lg font-semibold text-zinc-100 md:text-xl">
            Continuar assistindo
          </h2>
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide md:gap-2">
            {continueWatching.map((item) => (
              <Link
                key={item.id}
                href={
                  item.episodeId
                    ? `/watch/${item.id}?episodeId=${encodeURIComponent(item.episodeId)}`
                    : `/watch/${item.id}`
                }
                className="group relative min-w-[120px] flex-shrink-0 overflow-hidden rounded-md bg-zinc-900 transition hover:scale-105 hover:z-10 md:min-w-[140px]"
              >
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.name}
                    className="aspect-[16/9] w-full object-cover transition group-hover:opacity-80"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-800 text-center text-xs text-zinc-400">
                    {item.name}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[11px] leading-tight">
                  <div className="line-clamp-2 font-semibold text-zinc-50">
                    {item.seasonNumber && item.episodeNumber
                      ? `S${String(item.seasonNumber).padStart(2, "0")}E${String(
                          item.episodeNumber,
                        ).padStart(2, "0")} – ${item.episodeName || item.name}`
                      : item.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Minha lista */}
      {isLoggedIn && !hasSearch && favorites.length > 0 && (
        <section className="space-y-3 px-4 pb-6 pt-2 md:px-10">
          <h2 className="text-lg font-semibold text-zinc-100 md:text-xl">
            Minha lista
          </h2>
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide md:gap-2">
            {favorites.map((title) => (
              <Link
                key={title.id}
                href={`/title/${title.id}`}
                className="group relative min-w-[110px] flex-shrink-0 overflow-hidden rounded-md bg-zinc-900 transition hover:scale-105 hover:z-10 md:min-w-[130px]"
              >
                {title.posterUrl ? (
                  <img
                    src={title.posterUrl}
                    alt={title.name}
                    className="aspect-[2/3] w-full object-cover transition group-hover:opacity-80"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-800 text-center text-xs text-zinc-400">
                    {title.name}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[11px] leading-tight">
                  <div className="line-clamp-2 font-semibold text-zinc-50">
                    {title.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Resultados da busca */}
      {hasSearch && (
        <section className="px-4 py-8 md:px-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-100 md:text-xl">
              Resultados para "{search.trim()}"
            </h2>
            {searchLoading && (
              <span className="text-[11px] text-zinc-500">Buscando...</span>
            )}
          </div>

          {!searchLoading && searchResults.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum título encontrado.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {searchResults.map((title) => (
                <Link
                  key={title.id}
                  href={`/title/${title.id}`}
                  className="group relative overflow-hidden rounded-md bg-zinc-900 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {title.posterUrl ? (
                    <img
                      src={title.posterUrl}
                      alt={title.name}
                      className="aspect-[2/3] w-full object-cover transition group-hover:opacity-80"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-800 text-center text-xs text-zinc-400">
                      {title.name}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[11px] leading-tight">
                    <div className="line-clamp-2 font-semibold text-zinc-50">
                      {title.name}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Genre Carousels */}
      {isLoggedIn && !hasSearch && (
        <section className="space-y-8 px-4 py-10 md:px-10">
          {loading ? (
            <div className="text-center text-sm text-zinc-500">
              Carregando catálogo...
            </div>
          ) : (
            genres.slice(0, 6).map((genre) => {
              const titles = titlesByGenre[genre.id] || [];
              if (titles.length === 0) return null;

              return (
                <div key={genre.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-zinc-100 md:text-xl">
                      {genre.name}
                    </h2>
                    <Link
                      href={`/genres/${genre.id}`}
                      className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 md:text-sm"
                    >
                      Ver todos →
                    </Link>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => scrollGenreRow(genre.id, "left")}
                      className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/70 px-2 py-2 text-lg text-zinc-100 hover:bg-black/90 md:inline-flex"
                      aria-label="Anterior"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollGenreRow(genre.id, "right")}
                      className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/70 px-2 py-2 text-lg text-zinc-100 hover:bg-black/90 md:inline-flex"
                      aria-label="Próximo"
                    >
                      →
                    </button>
                    <div
                      ref={(el) => {
                        rowRefs.current[genre.id] = el;
                      }}
                      className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide md:gap-2"
                      onWheel={(e: React.WheelEvent<HTMLDivElement>) => {
                        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                          e.preventDefault();
                          e.currentTarget.scrollBy({
                            left: e.deltaY,
                            behavior: "smooth",
                          });
                        }
                      }}
                    >
                      {titles.map((title) => (
                        <Link
                          key={title.id}
                          href={`/title/${title.id}`}
                          className="group relative min-w-[110px] flex-shrink-0 overflow-hidden rounded-md bg-zinc-900 transition hover:scale-105 hover:z-10 md:min-w-[130px]"
                        >
                          {title.posterUrl ? (
                            <img
                              src={title.posterUrl}
                              alt={title.name}
                              className="aspect-[2/3] w-full object-cover transition group-hover:opacity-80"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-800 text-center text-xs text-zinc-400">
                              {title.name}
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[11px] leading-tight">
                            <div className="line-clamp-2 font-semibold text-zinc-50">
                              {title.name}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {!isLoggedIn && (
        <section className="px-4 py-16 text-center md:px-10">
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-2xl font-bold text-zinc-100 md:text-3xl">
              Filmes, séries e muito mais, sem limites.
            </h2>
            <p className="text-sm text-zinc-400 md:text-base">
              Assista onde quiser. Entre agora para explorar o catálogo completo.
            </p>
            <Link
              href="/login"
              className="inline-block rounded-md bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700"
            >
              Começar agora
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
