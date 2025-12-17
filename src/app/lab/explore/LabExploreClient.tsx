"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import PremiumNavbar from "@/components/ui/PremiumNavbar";
import TitleRow from "@/components/ui/TitleRow";
import { getLabContinue, getLabMyList, getLabWatchLater } from "../labStorage";

type Category = "movie" | "serie" | "anime";

type Sort = "most_watched" | "most_liked" | "most_voted" | "newest";

interface Genre {
  id: number;
  name: string;
}

interface LabTitle {
  id: string;
  tmdbId?: number;
  imdbId?: string | null;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  voteAverage: number;
  releaseDate: string | null;
  type: "MOVIE" | "SERIES";
}

function labTitleKey(t: LabTitle) {
  return `${t.type}-${t.tmdbId ?? t.id}`;
}

function dedupeLabTitles(list: LabTitle[]) {
  const seen = new Set<string>();
  const out: LabTitle[] = [];
  for (const t of list) {
    const k = labTitleKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function ExploreHeroSection({
  title,
  onPlay,
  onMore,
}: {
  title: LabTitle | null;
  onPlay: () => void;
  onMore: () => void;
}) {
  if (!title) return null;

  const year = title.releaseDate ? new Date(title.releaseDate).getFullYear() : null;

  return (
    <section className="relative h-[85vh] min-h-[600px] w-full overflow-hidden bg-black pt-16">
      <div className="absolute inset-0">
        {title.backdropUrl && (
          <>
            <img
              src={title.backdropUrl}
              alt={title.name}
              className="h-full w-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
          </>
        )}
      </div>

      <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-24 md:px-12 md:pb-32">
        <div className="max-w-2xl space-y-4 animate-fade-in">
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-2xl md:text-6xl lg:text-7xl">
            {title.name}
          </h1>

          <div className="flex items-center gap-3 text-sm text-zinc-200 md:text-base">
            {year && <span className="font-semibold">{year}</span>}
            {title.voteAverage ? (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  <span className="font-semibold">{title.voteAverage.toFixed(1)}</span>
                </div>
              </>
            ) : null}
            <>
              <span>•</span>
              <span className="rounded bg-zinc-800/80 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold uppercase">
                {title.type === "MOVIE" ? "Filme" : "Série"}
              </span>
            </>
          </div>

          {title.overview ? (
            <p className="line-clamp-3 text-sm text-zinc-200 drop-shadow-lg md:text-base lg:line-clamp-4">
              {title.overview}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button
              onClick={onPlay}
              className="flex items-center gap-3 rounded-full bg-gradient-to-r from-red-600 to-red-500 px-8 py-3 text-sm font-semibold text-white shadow-xl hover:from-red-500 hover:to-red-400 transition-all hover:scale-105"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span>Assistir</span>
            </button>

            <button
              onClick={onMore}
              className="flex items-center gap-2 rounded-full border border-zinc-500 bg-zinc-900/70 px-7 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-all hover:border-white hover:bg-zinc-800/80"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Mais informações</span>
            </button>

            <div className="ml-auto flex gap-2">
              <Link
                href="/lab"
                className="rounded-full bg-zinc-900/70 border border-zinc-700 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800/80"
              >
                Voltar
              </Link>
              <Link
                href="/lab/calendario"
                className="rounded-full bg-zinc-900/70 border border-zinc-700 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800/80"
              >
                Calendário
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}

export default function LabExploreClient({
  isLoggedIn,
  isAdmin,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = (searchParams.get("q") || "").trim();
  const searchMode = urlQuery.length >= 2;

  const [category, setCategory] = useState<Category>("movie");
  const [sort, setSort] = useState<Sort>("most_watched");
  const [year, setYear] = useState("");
  const [genre, setGenre] = useState("");

  const [genres, setGenres] = useState<Genre[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<LabTitle[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNextPage, setSearchNextPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchResults, setSearchResults] = useState<LabTitle[]>([]);

  const [trending, setTrending] = useState<LabTitle[]>([]);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<LabTitle[]>([]);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  const tmdbType = category === "movie" ? "movie" : "tv";

  useEffect(() => {
    async function loadGenres() {
      try {
        const res = await fetch(`/api/lab/tmdb/genres?type=${tmdbType}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data?.genres) ? (data.genres as Genre[]) : [];
        setGenres(list);
      } catch {
        // ignore
      }
    }

    loadGenres();
  }, [tmdbType]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("category", category);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", "24");
    if (year.trim()) params.set("year", year.trim());
    if (genre) params.set("genre", genre);
    return params.toString();
  }, [category, sort, page, year, genre]);

  useEffect(() => {
    async function load() {
      try {
        if (searchMode) return;
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/lab/discover?${queryString}`, { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text();
          setError(text || "Erro ao carregar");
          return;
        }

        const data = await res.json();
        const list = Array.isArray(data?.results) ? (data.results as LabTitle[]) : [];
        setResults(dedupeLabTitles(list));
        setHasMore(Boolean(data?.hasMore));
      } catch (e) {
        console.error(e);
        setError("Erro ao carregar catálogo");
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [queryString, searchMode]);

  async function performSearch({ startPage, append }: { startPage: number; append: boolean }) {
    const query = urlQuery;

    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchNextPage(1);
      setSearchHasMore(false);
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);

      const res = await fetch(
        `/api/lab/busca?q=${encodeURIComponent(query)}&page=${startPage}&limit=24`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        const text = await res.text();
        setSearchError(text || "Erro na busca");
        setSearchHasMore(false);
        return;
      }

      const data = await res.json();
      const list = Array.isArray(data?.results) ? (data.results as LabTitle[]) : [];
      const hasMoreRes = Boolean(data?.hasMore);
      const tmdbPageEnd = typeof data?.tmdbPageEnd === "number" ? (data.tmdbPageEnd as number) : startPage;
      const nextStart = tmdbPageEnd + 1;

      setSearchNextPage(nextStart);
      setSearchHasMore(hasMoreRes);
      setSearchResults((prev) => {
        const merged = append ? [...prev, ...list] : list;
        return dedupeLabTitles(merged);
      });
    } catch (e) {
      console.error(e);
      setSearchError("Erro na busca");
      setSearchHasMore(false);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (!searchMode) {
      setSearchResults([]);
      setSearchError(null);
      setSearchNextPage(1);
      setSearchHasMore(false);
      return;
    }

    setLoading(false);
    setSearchNextPage(1);
    performSearch({ startPage: 1, append: false });
  }, [urlQuery, searchMode]);

  useEffect(() => {
    if (searchMode) return;
    if (typeof window === "undefined") return;

    async function loadSmart() {
      try {
        setTrendingError(null);
        const tRes = await fetch("/api/lab/trending?type=all&time=week&limit=24", { cache: "no-store" });
        if (tRes.ok) {
          const tJson = await tRes.json();
          const list = Array.isArray(tJson?.results) ? (tJson.results as LabTitle[]) : [];
          setTrending(dedupeLabTitles(list));
        } else {
          setTrending([]);
        }
      } catch (e) {
        console.error(e);
        setTrending([]);
        setTrendingError("Erro ao carregar Em alta");
      }

      try {
        setRecommendationsError(null);

        const continueList = getLabContinue();
        const myList = getLabMyList();
        const watchLater = getLabWatchLater();

        const seeds: string[] = [];

        for (const it of continueList.slice(0, 3)) {
          const tmdb = Number(it.contentId);
          if (!Number.isFinite(tmdb)) continue;
          seeds.push(`${it.watchType === "filme" ? "movie" : "tv"}:${tmdb}`);
        }

        for (const it of myList.slice(0, 2)) {
          seeds.push(`${it.mediaType}:${it.tmdbId}`);
        }

        for (const it of watchLater.slice(0, 1)) {
          seeds.push(`${it.mediaType}:${it.tmdbId}`);
        }

        const uniqueSeeds = Array.from(new Set(seeds)).slice(0, 6);
        if (uniqueSeeds.length === 0) {
          setRecommendations([]);
          return;
        }

        const rRes = await fetch(`/api/lab/recommendations?limit=24&seeds=${encodeURIComponent(uniqueSeeds.join(","))}`, {
          cache: "no-store",
        });

        if (rRes.ok) {
          const rJson = await rRes.json();
          const list = Array.isArray(rJson?.results) ? (rJson.results as LabTitle[]) : [];
          setRecommendations(dedupeLabTitles(list));
        } else {
          setRecommendations([]);
        }
      } catch (e) {
        console.error(e);
        setRecommendations([]);
        setRecommendationsError("Erro ao carregar recomendações");
      }
    }

    loadSmart();
  }, [searchMode]);

  async function loadMoreSearch() {
    if (searching || !searchHasMore) return;
    const start = searchNextPage;
    await performSearch({ startPage: start, append: true });
  }

  function resetAndLoad(nextCategory: Category, nextSort: Sort) {
    setCategory(nextCategory);
    setSort(nextSort);
    setPage(1);
  }

  const titleForRow = useMemo(() => {
    const catLabel = category === "movie" ? "Filmes" : category === "serie" ? "Séries" : "Animes";
    const sortLabel =
      sort === "most_watched"
        ? "Mais assistidos"
        : sort === "most_liked"
        ? "Melhor avaliados"
        : sort === "most_voted"
        ? "Mais votados"
        : "Mais recentes";
    return `${catLabel} • ${sortLabel}`;
  }, [category, sort]);

  const heroTitle = useMemo(() => {
    const base = searchMode ? searchResults : results;
    if (!base || base.length === 0) return null;
    const withBackdrop = base.find((r) => Boolean(r.backdropUrl));
    return withBackdrop || base[0];
  }, [results, searchResults, searchMode]);

  function openHero() {
    if (!heroTitle) return;
    if (!heroTitle.tmdbId) return;
    router.push(`/lab/title/${heroTitle.tmdbId}?type=${heroTitle.type === "MOVIE" ? "movie" : "tv"}`);
  }

  const contentContainerClass = heroTitle
    ? "relative z-10 -mt-32 space-y-8 pb-16 px-4"
    : "pt-20 space-y-8 pb-16 px-4";

  return (
    <div className="min-h-screen bg-black">
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <ExploreHeroSection title={heroTitle} onPlay={openHero} onMore={openHero} />

      <div className={contentContainerClass}>
        <div className="max-w-7xl mx-auto">
          {!searchMode && (
            <>
              {trendingError ? <div className="text-red-400">{trendingError}</div> : null}
              {trending.length > 0 && (
                <TitleRow
                  title="🔥 Em alta no LAB"
                  titles={trending.map((t) => ({
                    id: labTitleKey(t),
                    name: t.name,
                    href: t.tmdbId ? `/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}` : "/lab",
                    posterUrl: t.posterUrl,
                    type: t.type,
                    voteAverage: t.voteAverage,
                    releaseDate: t.releaseDate,
                  }))}
                />
              )}

              {recommendationsError ? <div className="text-red-400">{recommendationsError}</div> : null}
              {recommendations.length > 0 && (
                <TitleRow
                  title="✨ Recomendados pra você"
                  titles={recommendations.map((t) => ({
                    id: labTitleKey(t),
                    name: t.name,
                    href: t.tmdbId ? `/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}` : "/lab",
                    posterUrl: t.posterUrl,
                    type: t.type,
                    voteAverage: t.voteAverage,
                    releaseDate: t.releaseDate,
                  }))}
                />
              )}
            </>
          )}

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => resetAndLoad("movie", sort)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border ${category === "movie" ? "bg-red-600 border-red-500 text-white" : "bg-zinc-900/60 border-zinc-700 text-zinc-200 hover:bg-zinc-800/70"}`}
                >
                  Filmes
                </button>
                <button
                  type="button"
                  onClick={() => resetAndLoad("serie", sort)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border ${category === "serie" ? "bg-red-600 border-red-500 text-white" : "bg-zinc-900/60 border-zinc-700 text-zinc-200 hover:bg-zinc-800/70"}`}
                >
                  Séries
                </button>
                <button
                  type="button"
                  onClick={() => resetAndLoad("anime", sort)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border ${category === "anime" ? "bg-red-600 border-red-500 text-white" : "bg-zinc-900/60 border-zinc-700 text-zinc-200 hover:bg-zinc-800/70"}`}
                >
                  Animes
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {([
                  ["most_watched", "Mais assistidos"],
                  ["most_liked", "Melhor avaliados"],
                  ["most_voted", "Mais votados"],
                  ["newest", "Mais recentes"],
                ] as Array<[Sort, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => resetAndLoad(category, key)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border ${sort === key ? "bg-white text-black border-white" : "bg-zinc-900/60 border-zinc-700 text-zinc-200 hover:bg-zinc-800/70"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <input
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Ano (ex: 2024)"
                  className="w-full md:w-44 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />

                <select
                  value={genre}
                  onChange={(e) => {
                    setGenre(e.target.value);
                    setPage(1);
                  }}
                  className="w-full md:w-64 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="">Gênero (Todos)</option>
                  {genres.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700 text-white disabled:opacity-50"
                  >
                    ←
                  </button>
                  <span className="text-zinc-400 text-sm">Página {page}</span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasMore || loading}
                    className="px-4 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700 text-white disabled:opacity-50"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {loading && !searchMode ? (
              <div className="text-zinc-400">Carregando...</div>
            ) : searchMode ? (
              searchError ? (
                <div className="text-red-400">{searchError}</div>
              ) : searchResults.length === 0 && !searching ? (
                <div className="text-zinc-400">Nenhum resultado para “{urlQuery}”.</div>
              ) : (
                <>
                  <TitleRow
                    title={`🔍 Resultados para "${urlQuery}"`}
                    titles={searchResults.map((t) => ({
                      id: labTitleKey(t),
                      name: t.name,
                      href: t.tmdbId ? `/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}` : "/lab",
                      posterUrl: t.posterUrl,
                      type: t.type,
                      voteAverage: t.voteAverage,
                      releaseDate: t.releaseDate,
                    }))}
                  />

                  {searchHasMore && (
                    <button
                      type="button"
                      onClick={loadMoreSearch}
                      disabled={searching}
                      className="mt-6 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      {searching ? "Carregando..." : "Carregar mais"}
                    </button>
                  )}
                </>
              )
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : results.length === 0 ? (
              <div className="text-zinc-400">Nenhum item encontrado com esses filtros.</div>
            ) : (
              <TitleRow
                title={titleForRow}
                titles={results.map((t) => ({
                  id: labTitleKey(t),
                  name: t.name,
                  href: t.tmdbId ? `/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}` : "/lab",
                  posterUrl: t.posterUrl,
                  type: t.type,
                  voteAverage: t.voteAverage,
                  releaseDate: t.releaseDate,
                }))}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
