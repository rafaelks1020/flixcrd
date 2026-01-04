"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import PremiumNavbar from "@/components/ui/PremiumNavbar";
import PremiumTitleRow from "@/components/ui/PremiumTitleRow";
import BrowseHero from "@/components/ui/BrowseHero";
import { Sparkles } from "lucide-react";
import { getLabContinue, getLabMyList, getLabWatchLater } from "../labStorage";

type Category = "movie" | "serie" | "anime" | "dorama";

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
  isAnime?: boolean;
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

// ExploreHeroSection removed (replaced by BrowseHero)

interface LabExploreClientProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  initialCategory?: Category;
}

export default function LabExploreClient({
  isLoggedIn,
  isAdmin,
  initialCategory,
}: LabExploreClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = (searchParams.get("q") || "").trim();
  const searchMode = urlQuery.length >= 2;

  const [category, setCategory] = useState<Category>(initialCategory || "movie");
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
        const mappedList = list.map(it => ({ ...it, isAnime: Boolean(it.isAnime) }));
        const merged = append ? [...prev, ...mappedList] : mappedList;
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
        const tRes = await fetch(`/api/lab/trending?category=${category}&type=all&time=week&limit=24`, { cache: "no-store" });
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

        const rRes = await fetch(`/api/lab/recommendations?category=${category}&limit=24&seeds=${encodeURIComponent(uniqueSeeds.join(","))}`, {
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
    const catLabel = category === "movie" ? "Filmes" : category === "serie" ? "Séries" : category === "anime" ? "Animes" : "Doramas";
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
    <div className="min-h-screen bg-black font-sans selection:bg-red-500/30">
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {heroTitle && (
        <BrowseHero
          title={{
            id: String(heroTitle.tmdbId || heroTitle.id),
            name: heroTitle.name,
            backdropUrl: heroTitle.backdropUrl,
            overview: heroTitle.overview,
            type: heroTitle.type,
            voteAverage: heroTitle.voteAverage,
            releaseDate: heroTitle.releaseDate
          }}
        />
      )}

      <div className={contentContainerClass}>
        <div className="max-w-[1800px] mx-auto">
          {!searchMode && (
            <div className="space-y-12">
              {trendingError ? <div className="text-red-400">{trendingError}</div> : null}
              {trending.length > 0 && (
                <PremiumTitleRow
                  title="🔥 Em alta no LAB"
                  titles={trending.map((t) => ({
                    id: String(t.tmdbId || t.id),
                    name: t.name,
                    href: t.tmdbId ? `/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}` : "/lab",
                    posterUrl: t.posterUrl,
                    backdropUrl: t.backdropUrl,
                    type: t.type,
                    voteAverage: t.voteAverage,
                    releaseDate: t.releaseDate,
                  }))}
                />
              )}

              {recommendationsError ? <div className="text-red-400">{recommendationsError}</div> : null}
              {recommendations.length > 0 && (
                <PremiumTitleRow
                  title="✨ Recomendados pra você"
                  titles={recommendations.map((t) => ({
                    id: String(t.tmdbId || t.id),
                    name: t.name,
                    href: t.tmdbId ? `/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}` : "/lab",
                    posterUrl: t.posterUrl,
                    backdropUrl: t.backdropUrl,
                    type: t.type,
                    voteAverage: t.voteAverage,
                    releaseDate: t.releaseDate,
                  }))}
                />
              )}
            </div>
          )}

          {/* Filters Section - Glassmorphism */}
          <div className="mt-12 mb-8 sticky top-24 z-40 bg-black/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col xl:flex-row gap-8 items-center justify-between">
            <div className="flex flex-col gap-4 w-full xl:w-auto">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
                <button
                  type="button"
                  onClick={() => resetAndLoad("movie", sort)}
                  className={cn("px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border", category === "movie" ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20" : "bg-zinc-900/50 text-zinc-400 border-white/5 hover:bg-zinc-800 hover:text-white")}
                >
                  Filmes
                </button>
                <button
                  type="button"
                  onClick={() => resetAndLoad("serie", sort)}
                  className={cn("px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border", category === "serie" ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20" : "bg-zinc-900/50 text-zinc-400 border-white/5 hover:bg-zinc-800 hover:text-white")}
                >
                  Séries
                </button>
                <button
                  type="button"
                  onClick={() => resetAndLoad("anime", sort)}
                  className={cn("px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border", category === "anime" ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20" : "bg-zinc-900/50 text-zinc-400 border-white/5 hover:bg-zinc-800 hover:text-white")}
                >
                  Animes
                </button>
                <button
                  type="button"
                  onClick={() => resetAndLoad("dorama", sort)}
                  className={cn("px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border", category === "dorama" ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20" : "bg-zinc-900/50 text-zinc-400 border-white/5 hover:bg-zinc-800 hover:text-white")}
                >
                  Doramas
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
                {([
                  ["most_watched", "Mais Vistos"],
                  ["most_liked", "Melhores"],
                  ["most_voted", "Populares"],
                  ["newest", "Novidades"],
                ] as Array<[Sort, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => resetAndLoad(category, key)}
                    className={cn("px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap", sort === key ? "bg-white text-black border-white" : "bg-zinc-900/50 text-zinc-500 border-white/5 hover:bg-zinc-800 hover:text-white")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto items-center">
              <input
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setPage(1);
                }}
                placeholder="ANO (EX: 2024)"
                className="w-full md:w-32 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-primary/50 outline-none transition-all font-bold uppercase tracking-wider placeholder:text-zinc-600 text-center"
              />

              <select
                value={genre}
                onChange={(e) => {
                  setGenre(e.target.value);
                  setPage(1);
                }}
                className="w-full md:w-48 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-primary/50 outline-none transition-all font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-white/5"
              >
                <option value="">Gênero (Todos)</option>
                {genres.map((g) => (
                  <option key={g.id} value={String(g.id)} className="bg-black text-zinc-300">
                    {g.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-10 h-10 rounded-xl bg-zinc-900/80 border border-white/10 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all disabled:opacity-30 disabled:hover:bg-zinc-900/80 disabled:hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 w-20 text-center">Página {page}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore || loading}
                  className="w-10 h-10 rounded-xl bg-zinc-900/80 border border-white/10 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all disabled:opacity-30 disabled:hover:bg-zinc-900/80 disabled:hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 min-h-[400px]">
            {searchMode && (
              (() => {
                const filtered = category === "movie" ? searchResults.filter(t => t.type === "MOVIE")
                  : category === "anime" ? searchResults.filter(t => t.type === "SERIES" && t.isAnime)
                    : category === "serie" ? searchResults.filter(t => t.type === "SERIES" && !t.isAnime)
                      : category === "dorama" ? searchResults.filter(t => t.type === "SERIES" && !t.isAnime) // Dorama is series
                        : searchResults;

                const otherCount = (filtered.length === 0 && searchResults.length > 0) ? searchResults.length : 0;

                return otherCount > 0 ? (
                  <div className="mb-8 bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <Sparkles size={16} className="text-primary animate-pulse" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/80">
                      Nenhum resultado em "{category === 'movie' ? 'Filmes' : category === 'serie' ? 'Séries' : category === 'anime' ? 'Animes' : 'Doramas'}", mas encontramos {otherCount} itens em outras categorias. Tente mudar a aba!
                    </p>
                  </div>
                ) : null;
              })()
            )}
            {loading && !searchMode ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchMode ? (
              searchError ? (
                <div className="text-red-400">{searchError}</div>
              ) : searchResults.length === 0 && !searching ? (
                <div className="text-center py-20">
                  <p className="text-zinc-500 font-bold uppercase tracking-widest">Nenhum resultado para “{urlQuery}”</p>
                </div>
              ) : (
                <>
                  <PremiumTitleRow
                    title={`🔍 Resultados para "${urlQuery}"`}
                    titles={
                      (category === "movie" ? searchResults.filter(t => t.type === "MOVIE")
                        : category === "anime" ? searchResults.filter(t => t.type === "SERIES" && t.isAnime)
                          : category === "serie" ? searchResults.filter(t => t.type === "SERIES" && !t.isAnime)
                            : category === "dorama" ? searchResults.filter(t => t.type === "SERIES" && !t.isAnime)
                              : searchResults).map((t) => ({
                                id: String(t.tmdbId || t.id),
                                name: t.name,
                                href: t.tmdbId ? `/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}` : "/lab",
                                posterUrl: t.posterUrl,
                                backdropUrl: t.backdropUrl,
                                type: t.type,
                                voteAverage: t.voteAverage,
                                releaseDate: t.releaseDate,
                              }))
                    }
                  />

                  {searchHasMore && (
                    <div className="flex justify-center mt-12 pb-12">
                      <button
                        type="button"
                        onClick={loadMoreSearch}
                        disabled={searching}
                        className="px-8 py-4 rounded-full bg-white/5 border border-white/10 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-white hover:text-black transition-all disabled:opacity-40"
                      >
                        {searching ? "Carregando..." : "Carregar mais"}
                      </button>
                    </div>
                  )}
                </>
              )
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : results.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-zinc-500 font-bold uppercase tracking-widest">Nenhum item encontrado com esses filtros</p>
              </div>
            ) : (
              <PremiumTitleRow
                title={titleForRow}
                titles={results.map((t) => ({
                  id: String(t.tmdbId || t.id),
                  name: t.name,
                  href: t.tmdbId ? `/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}` : "/lab",
                  posterUrl: t.posterUrl,
                  backdropUrl: t.backdropUrl,
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
