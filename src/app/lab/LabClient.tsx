"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import PremiumNavbar from "@/components/ui/PremiumNavbar";
import PremiumHero from "@/components/ui/PremiumHero";
import PremiumTitleRow from "@/components/ui/PremiumTitleRow";
import TitleCard from "@/components/ui/TitleCard";
import TitleRow from "@/components/ui/TitleRow";
import { SkeletonRow } from "@/components/ui/SkeletonCard";
import { getLabContinue, getLabMyList, getLabWatchLater } from "./labStorage";

interface LabTitle {
  id: string;
  tmdbId?: number;
  imdbId?: string | null;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview?: string;
  voteAverage: number | null;
  releaseDate: string | null;
  type: string;
}

interface HeroTitle {
  id: string;
  tmdbId?: number;
  imdbId?: string | null;
  name: string;
  overview: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  type: string;
}

interface LabClientProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

type Category = "movie" | "serie" | "anime";
type Sort = "most_watched" | "most_liked" | "most_voted" | "newest";

interface Genre {
  id: number;
  name: string;
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

function LabHeroSection({
  title,
  onPlay,
  onMore,
}: {
  title: HeroTitle | null;
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
            {title.voteAverage && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  <span className="font-semibold">{title.voteAverage.toFixed(1)}</span>
                </div>
              </>
            )}
            {title.type && (
              <>
                <span>•</span>
                <span className="rounded bg-zinc-800/80 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold uppercase">
                  {title.type === "MOVIE" ? "Filme" : "Série"}
                </span>
              </>
            )}
          </div>

          {title.overview && (
            <p className="line-clamp-3 text-sm text-zinc-200 drop-shadow-lg md:text-base lg:line-clamp-4">
              {title.overview}
            </p>
          )}

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
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}

export default function LabClient({ isLoggedIn, isAdmin }: LabClientProps) {
  const router = useRouter();

  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [filmes, setFilmes] = useState<LabTitle[]>([]);
  const [series, setSeries] = useState<LabTitle[]>([]);
  const [animes, setAnimes] = useState<LabTitle[]>([]);
  const [loading, setLoading] = useState(true);

  const [heroTitle, setHeroTitle] = useState<HeroTitle | null>(null);

  // Busca com persistência
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LabTitle[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNextPage, setSearchNextPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<number | null>(null);

  const searchMode = searchQuery.trim().length >= 2;

  const [category, setCategory] = useState<Category>("movie");
  const [sort, setSort] = useState<Sort>("most_watched");
  const [year, setYear] = useState("");
  const [genre, setGenre] = useState("");
  const [genres, setGenres] = useState<Genre[]>([]);

  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [gridResults, setGridResults] = useState<LabTitle[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const [labContinue, setLabContinue] = useState<ReturnType<typeof getLabContinue>>([]);
  const [labMyList, setLabMyList] = useState<ReturnType<typeof getLabMyList>>([]);
  const [labWatchLater, setLabWatchLater] = useState<ReturnType<typeof getLabWatchLater>>([]);

  const tmdbType = category === "movie" ? "movie" : "tv";

  // Restaurar busca do localStorage ao carregar
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedQuery = localStorage.getItem("lab_search_query");
      if (savedQuery) {
        setSearchQuery(savedQuery);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const load = () => {
      setLabContinue(getLabContinue());
      setLabMyList(getLabMyList());
      setLabWatchLater(getLabWatchLater());
    };

    load();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

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

  const discoverQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("category", category);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", "28");
    if (year.trim()) params.set("year", year.trim());
    if (genre) params.set("genre", genre);
    return params.toString();
  }, [category, sort, page, year, genre]);

  useEffect(() => {
    async function loadDiscover() {
      if (searchMode) return;
      try {
        setGridLoading(true);
        setGridError(null);
        const res = await fetch(`/api/lab/discover?${discoverQueryString}`, { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text();
          setGridError(text || "Erro ao carregar");
          setGridResults([]);
          setHasMore(false);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data?.results) ? (data.results as LabTitle[]) : [];
        setGridResults(dedupeLabTitles(list));
        setHasMore(Boolean(data?.hasMore));
      } catch (e) {
        console.error(e);
        setGridError("Erro ao carregar catálogo");
        setGridResults([]);
        setHasMore(false);
      } finally {
        setGridLoading(false);
      }
    }

    loadDiscover();
  }, [discoverQueryString, searchMode]);

  async function performSearch({ startPage, append }: { startPage: number; append: boolean }) {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearchNextPage(1);
      setSearchHasMore(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("lab_search_query");
      }
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("lab_search_query", query);
    }

    try {
      setSearching(true);
      setSearchError(null);

      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      const res = await fetch(
        `/api/lab/busca?q=${encodeURIComponent(query)}&page=${startPage}&limit=24`,
        { signal: controller.signal }
      );

      if (!res.ok) {
        const text = await res.text();
        setSearchError(text || "Erro na busca");
        setSearchHasMore(false);
        return;
      }

      const data = await res.json();
      const results = Array.isArray(data?.results) ? (data.results as LabTitle[]) : [];
      const hasMore = Boolean(data?.hasMore);
      const tmdbPageEnd = typeof data?.tmdbPageEnd === "number" ? (data.tmdbPageEnd as number) : startPage;
      const nextStart = tmdbPageEnd + 1;

      setSearchNextPage(nextStart);
      setSearchHasMore(hasMore);
      setSearchResults((prev) => {
        const merged = append ? [...prev, ...results] : results;
        return dedupeLabTitles(merged);
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Erro na busca:", err);
      setSearchError("Erro na busca");
      setSearchHasMore(false);
    } finally {
      setSearching(false);
    }
  }

  // Buscar enquanto digita (debounce)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearchNextPage(1);
      setSearchHasMore(false);
      localStorage.removeItem("lab_search_query");
      return;
    }

    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchNextPage(1);
      setSearchHasMore(false);
      return;
    }

    searchDebounceRef.current = window.setTimeout(() => {
      setSearchNextPage(1);
      performSearch({ startPage: 1, append: false });
    }, 450);

    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoading(true);

        const [filmesRes, seriesRes, animesRes] = await Promise.allSettled([
          fetch(`/api/lab/catalogo?type=movie&limit=20`),
          fetch(`/api/lab/catalogo?type=serie&limit=20`),
          fetch(`/api/lab/catalogo?type=anime&limit=20`),
        ]);

        let heroSet = false;

        if (filmesRes.status === "fulfilled" && filmesRes.value.ok) {
          const data = await filmesRes.value.json();
          const items: LabTitle[] = data.items || [];
          setFilmes(items);
          if (items.length > 0 && !heroSet) {
            const hero = items[Math.floor(Math.random() * Math.min(5, items.length))];
            setHeroTitle({
              id: hero.id,
              tmdbId: hero.tmdbId,
              imdbId: hero.imdbId,
              name: hero.name,
              overview: hero.overview || null,
              backdropUrl: hero.backdropUrl,
              releaseDate: hero.releaseDate,
              voteAverage: hero.voteAverage,
              type: hero.type,
            });
            heroSet = true;
          }
        }

        if (seriesRes.status === "fulfilled" && seriesRes.value.ok) {
          const data = await seriesRes.value.json();
          const items: LabTitle[] = data.items || [];
          setSeries(items);
        }

        if (animesRes.status === "fulfilled" && animesRes.value.ok) {
          const data = await animesRes.value.json();
          const items: LabTitle[] = data.items || [];
          setAnimes(items);
        }
      } catch (err) {
        console.error("Erro ao carregar catálogo Lab:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, []);

  function handlePlayHero() {
    if (!heroTitle) return;

    if (heroTitle.type === "MOVIE") {
      if (heroTitle.imdbId) {
        router.push(`/lab/watch?type=filme&id=${heroTitle.imdbId}`);
        return;
      }
    } else {
      if (heroTitle.tmdbId) {
        router.push(`/lab/watch?type=serie&id=${heroTitle.tmdbId}&season=1&episode=1`);
        return;
      }
    }

    const mediaType = heroTitle.type === "MOVIE" ? "movie" : "tv";
    router.push(`/lab/title/${heroTitle.tmdbId}?type=${mediaType}`);
  }

  function handleMoreHero() {
    if (!heroTitle) return;
    const mediaType = heroTitle.type === "MOVIE" ? "movie" : "tv";
    router.push(`/lab/title/${heroTitle.tmdbId}?type=${mediaType}`);
  }

  async function handleSearch() {
    setSearchNextPage(1);
    await performSearch({ startPage: 1, append: false });
  }

  async function loadMoreSearch() {
    if (searching || !searchHasMore) return;
    const start = searchNextPage;
    await performSearch({ startPage: start, append: true });
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSearchNextPage(1);
    setSearchHasMore(false);
    localStorage.removeItem("lab_search_query");
  }

  function resetAndLoad(nextCategory: Category, nextSort: Sort) {
    setCategory(nextCategory);
    setSort(nextSort);
    setPage(1);
  }

  const gridTitle = useMemo(() => {
    const catLabel = category === "movie" ? "Filmes" : category === "serie" ? "Séries" : "Animes";
    const sortLabel =
      sort === "most_watched"
        ? "Mais assistidos"
        : sort === "most_liked"
        ? "Melhor avaliados"
        : sort === "most_voted"
        ? "Mais votados"
        : "Mais recentes";
    return `${catLabel} - ${sortLabel}`;
  }, [category, sort]);

  const filteredSearchResults = useMemo(() => {
    if (!searchMode) return searchResults;
    if (category === "movie") return searchResults.filter((t) => t.type === "MOVIE");
    return searchResults.filter((t) => t.type !== "MOVIE");
  }, [searchResults, searchMode, category]);

  const heroCarouselTitles = useMemo(() => {
    const base = filmes.length > 0 ? filmes : series.length > 0 ? series : animes;
    if (!base || base.length === 0) return [];

    const withBackdrop = base.filter((t) => Boolean(t.backdropUrl));
    const pool = (withBackdrop.length > 0 ? withBackdrop : base).slice(0, 8);

    return pool.map<HeroTitle>((t) => ({
      id: t.id,
      tmdbId: t.tmdbId,
      imdbId: t.imdbId,
      name: t.name,
      overview: t.overview || null,
      backdropUrl: t.backdropUrl,
      releaseDate: t.releaseDate,
      voteAverage: t.voteAverage,
      type: t.type,
    }));
  }, [filmes, series, animes]);

  useEffect(() => {
    if (heroCarouselTitles.length === 0) return;

    const randomIndex = Math.floor(Math.random() * heroCarouselTitles.length);
    setCurrentHeroIndex(randomIndex);

    const interval = window.setInterval(() => {
      setIsTransitioning(true);

      window.setTimeout(() => {
        setCurrentHeroIndex((prevIndex) => (prevIndex + 1) % heroCarouselTitles.length);
        setIsTransitioning(false);
      }, 300);
    }, 8000);

    return () => window.clearInterval(interval);
  }, [heroCarouselTitles]);

  const activePremiumHero = heroCarouselTitles[currentHeroIndex] || heroTitle;

  const premiumHeroInfoHref = useMemo(() => {
    if (!activePremiumHero?.tmdbId) return "/lab";
    const mediaType = activePremiumHero.type === "MOVIE" ? "movie" : "tv";
    return `/lab/title/${activePremiumHero.tmdbId}?type=${mediaType}`;
  }, [activePremiumHero]);

  const premiumHeroPlayHref = useMemo(() => {
    if (!activePremiumHero) return "/lab";

    if (activePremiumHero.type === "MOVIE") {
      if (activePremiumHero.imdbId) {
        const tmdb = activePremiumHero.tmdbId ? `&tmdb=${activePremiumHero.tmdbId}` : "";
        return `/lab/watch?type=filme&id=${activePremiumHero.imdbId}${tmdb}`;
      }
      return premiumHeroInfoHref;
    }

    if (activePremiumHero.tmdbId) {
      return `/lab/watch?type=serie&id=${activePremiumHero.tmdbId}&season=1&episode=1&tmdb=${activePremiumHero.tmdbId}`;
    }

    return premiumHeroInfoHref;
  }, [activePremiumHero, premiumHeroInfoHref]);

  const usePremiumUi = true;

  if (usePremiumUi) {
    const mapLabTitleToPremium = (t: LabTitle) => {
      const tmdbId = t.tmdbId ?? Number(t.id);
      const mediaType = t.type === "MOVIE" ? "movie" : "tv";
      const href = Number.isFinite(tmdbId) ? `/lab/title/${tmdbId}?type=${mediaType}` : "/lab";
      return {
        id: labTitleKey(t),
        href,
        name: t.name,
        posterUrl: t.posterUrl,
        type: t.type,
        releaseDate: t.releaseDate,
        voteAverage: t.voteAverage,
      };
    };

    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#000" }}>
        <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

        {activePremiumHero && (
          <div style={{ position: "relative" }}>
            <div
              style={{
                transition: "opacity 0.3s ease-in-out",
                opacity: isTransitioning ? 0 : 1,
              }}
            >
              <PremiumHero
                title={activePremiumHero}
                isLoggedIn={isLoggedIn}
                playHref={premiumHeroPlayHref}
                infoHref={premiumHeroInfoHref}
              />
            </div>

            {heroCarouselTitles.length > 1 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "30px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: "8px",
                  zIndex: 10,
                }}
              >
                {heroCarouselTitles.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setIsTransitioning(true);
                      setTimeout(() => {
                        setCurrentHeroIndex(index);
                        setIsTransitioning(false);
                      }, 300);
                    }}
                    style={{
                      width: currentHeroIndex === index ? "32px" : "8px",
                      height: "8px",
                      borderRadius: "4px",
                      border: "none",
                      background:
                        currentHeroIndex === index
                          ? "linear-gradient(90deg, #dc2626 0%, #f87171 100%)"
                          : "rgba(255, 255, 255, 0.3)",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow:
                        currentHeroIndex === index
                          ? "0 0 10px rgba(220, 38, 38, 0.5)"
                          : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (currentHeroIndex !== index) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.5)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentHeroIndex !== index) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
          <div style={{ padding: "0 4%", marginBottom: "2rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <Link
                href="/lab/explore"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 18px",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "999px",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                ✨ Explorar
              </Link>
              <Link
                href="/lab/calendario"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 18px",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "999px",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                📅 Calendário
              </Link>
            </div>
          </div>
          {labContinue.length > 0 && (
            <div id="lab-continue-watching">
              <PremiumTitleRow
                title="Continuar Assistindo"
                titles={labContinue.map((it) => ({
                  id: it.key,
                  href: it.watchUrl,
                  name: it.title || "Continuar",
                  posterUrl: it.posterUrl,
                  type: it.watchType === "filme" ? "MOVIE" : "SERIES",
                }))}
              />
            </div>
          )}

          {labMyList.length > 0 && (
            <PremiumTitleRow
              title="Minha Lista"
              titles={labMyList.map((it) => ({
                id: it.key,
                href: `/lab/title/${it.tmdbId}?type=${it.mediaType}`,
                name: it.title,
                posterUrl: it.posterUrl,
                type: it.type,
              }))}
            />
          )}

          {labWatchLater.length > 0 && (
            <PremiumTitleRow
              title="Assistir Depois"
              titles={labWatchLater.map((it) => ({
                id: it.key,
                href: `/lab/title/${it.tmdbId}?type=${it.mediaType}`,
                name: it.title,
                posterUrl: it.posterUrl,
                type: it.type,
              }))}
            />
          )}

          {filmes.length > 0 && <PremiumTitleRow title="Filmes" titles={filmes.map(mapLabTitleToPremium)} />}
          {series.length > 0 && <PremiumTitleRow title="Séries" titles={series.map(mapLabTitleToPremium)} />}
          {animes.length > 0 && <PremiumTitleRow title="Animes" titles={animes.map(mapLabTitleToPremium)} />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <LabHeroSection title={heroTitle} onPlay={handlePlayHero} onMore={handleMoreHero} />

      <div className="relative z-10 -mt-32 space-y-8 pb-16 px-4">
        {/* Barra de Busca */}
        <div className="max-w-4xl mx-auto mb-8 px-4 md:px-8">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar filmes, séries, animes..."
                className="w-full px-5 py-3 pr-12 rounded-full bg-zinc-900/90 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-14 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              )}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                {searching ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>
            </div>

            <Link
              href="/lab/calendario"
              className="whitespace-nowrap px-5 py-3 rounded-full bg-zinc-900/90 border border-zinc-700 text-white font-semibold hover:bg-zinc-800/80"
            >
              📅 Calendário
            </Link>

            <Link
              href="/lab/explore"
              className="whitespace-nowrap px-5 py-3 rounded-full bg-zinc-900/90 border border-zinc-700 text-white font-semibold hover:bg-zinc-800/80"
            >
              ✨ Explorar
            </Link>
          </div>
        </div>

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {labContinue.length > 0 && (
              <TitleRow
                title="Continuar assistindo (LAB)"
                titles={labContinue.map((it) => ({
                  id: it.key,
                  name: it.title || "Continuar",
                  href: it.watchUrl,
                  posterUrl: it.posterUrl,
                  type: it.watchType === "filme" ? "MOVIE" : "SERIES",
                }))}
              />
            )}

            {labMyList.length > 0 && (
              <TitleRow
                title="Minha lista (LAB)"
                titles={labMyList.map((it) => ({
                  id: it.key,
                  name: it.title,
                  href: `/lab/title/${it.tmdbId}?type=${it.mediaType}`,
                  posterUrl: it.posterUrl,
                  type: it.type,
                }))}
              />
            )}

            {labWatchLater.length > 0 && (
              <TitleRow
                title="Assistir depois (LAB)"
                titles={labWatchLater.map((it) => ({
                  id: it.key,
                  name: it.title,
                  href: `/lab/title/${it.tmdbId}?type=${it.mediaType}`,
                  posterUrl: it.posterUrl,
                  type: it.type,
                }))}
              />
            )}

            {/* Resultados da Busca */}
            {searchMode && (
              <>
                {searchError ? (
                  <div className="max-w-7xl mx-auto px-4 text-red-400">{searchError}</div>
                ) : filteredSearchResults.length === 0 && !searching && !searchHasMore ? (
                  <div className="max-w-7xl mx-auto px-4 text-zinc-400">
                    Nenhum resultado disponível no LAB para “{searchQuery.trim()}”.
                  </div>
                ) : filteredSearchResults.length > 0 ? (
                  <>
                    <div className="max-w-7xl mx-auto px-4 md:px-8">
                      <div className="flex gap-6 border-b border-white/10">
                        <button
                          type="button"
                          onClick={() => setCategory("movie")}
                          className={`-mb-px pb-3 text-sm font-semibold border-b-2 transition-colors ${category === "movie" ? "text-white border-red-500" : "text-zinc-400 border-transparent hover:text-white"}`}
                        >
                          Filmes
                        </button>
                        <button
                          type="button"
                          onClick={() => setCategory("serie")}
                          className={`-mb-px pb-3 text-sm font-semibold border-b-2 transition-colors ${category === "serie" ? "text-white border-red-500" : "text-zinc-400 border-transparent hover:text-white"}`}
                        >
                          Séries
                        </button>
                        <button
                          type="button"
                          onClick={() => setCategory("anime")}
                          className={`-mb-px pb-3 text-sm font-semibold border-b-2 transition-colors ${category === "anime" ? "text-white border-red-500" : "text-zinc-400 border-transparent hover:text-white"}`}
                        >
                          Animes
                        </button>
                      </div>
                      <h2 className="mb-4 text-xl font-bold text-white md:text-2xl">
                        {`🔍 Resultados para "${searchQuery.trim()}"`}
                      </h2>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
                        {filteredSearchResults.map((t) => (
                          <div key={labTitleKey(t)}>
                            <TitleCard
                              id={t.id}
                              name={t.name}
                              href={`/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}`}
                              posterUrl={t.posterUrl}
                              type={t.type}
                              voteAverage={t.voteAverage}
                              releaseDate={t.releaseDate}
                            />
                            <Link
                              href={`/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}`}
                              className="mt-2 block text-sm text-zinc-200 hover:text-white line-clamp-2"
                            >
                              {t.name}
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>

                    {searchHasMore && (
                      <div className="max-w-7xl mx-auto px-4">
                        <button
                          onClick={loadMoreSearch}
                          disabled={searching}
                          className="mt-6 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                        >
                          {searching ? "Carregando..." : "Carregar mais"}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="max-w-7xl mx-auto px-4 mt-4 text-zinc-400">
                    Nenhum item nessa categoria ainda. Tenta carregar mais.
                  </div>
                )}
              </>
            )}

            {!searchMode && (
              <>
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                  <div className="mt-3">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                      <h2 className="text-2xl md:text-3xl font-bold text-white">{gridTitle}</h2>

                      <div className="flex items-center gap-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="h-9 w-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-40"
                        >
                          ←
                        </button>
                        <span className="text-zinc-400 text-sm">Página {page}</span>
                        <button
                          type="button"
                          onClick={() => setPage((p) => p + 1)}
                          disabled={!hasMore || gridLoading}
                          className="h-9 w-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-40"
                        >
                          →
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-6 border-b border-white/10">
                      <button
                        type="button"
                        onClick={() => resetAndLoad("movie", sort)}
                        className={`-mb-px pb-3 text-sm font-semibold border-b-2 transition-colors ${category === "movie" ? "text-white border-red-500" : "text-zinc-400 border-transparent hover:text-white"}`}
                      >
                        Filmes
                      </button>
                      <button
                        type="button"
                        onClick={() => resetAndLoad("serie", sort)}
                        className={`-mb-px pb-3 text-sm font-semibold border-b-2 transition-colors ${category === "serie" ? "text-white border-red-500" : "text-zinc-400 border-transparent hover:text-white"}`}
                      >
                        Séries
                      </button>
                      <button
                        type="button"
                        onClick={() => resetAndLoad("anime", sort)}
                        className={`-mb-px pb-3 text-sm font-semibold border-b-2 transition-colors ${category === "anime" ? "text-white border-red-500" : "text-zinc-400 border-transparent hover:text-white"}`}
                      >
                        Animes
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
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
                          className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold border transition-colors ${sort === key ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-white/10 text-zinc-300 hover:bg-white/5"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center">
                      <input
                        value={year}
                        onChange={(e) => {
                          setYear(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Ano (ex: 2024)"
                        className="w-full md:w-44 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/60"
                      />

                      <div className="w-full overflow-x-auto scrollbar-hide">
                        <div className="flex gap-2 pb-2">
                          <button
                            type="button"
                            onClick={() => {
                              setGenre("");
                              setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold border whitespace-nowrap transition-colors ${!genre ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-white/10 text-zinc-300 hover:bg-white/5"}`}
                          >
                            Todos
                          </button>
                          {genres.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setGenre(String(g.id));
                                setPage(1);
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold border whitespace-nowrap transition-colors ${genre === String(g.id) ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-white/10 text-zinc-300 hover:bg-white/5"}`}
                            >
                              {g.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    {gridLoading ? (
                      <div className="text-zinc-400">Carregando...</div>
                    ) : gridError ? (
                      <div className="text-red-400">{gridError}</div>
                    ) : gridResults.length === 0 ? (
                      <div className="text-zinc-400">Nenhum item encontrado com esses filtros.</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
                          {gridResults.map((t) => (
                            <div key={labTitleKey(t)}>
                              <TitleCard
                                id={t.id}
                                name={t.name}
                                href={`/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}`}
                                posterUrl={t.posterUrl}
                                type={t.type}
                                voteAverage={t.voteAverage}
                                releaseDate={t.releaseDate}
                              />
                              <Link
                                href={`/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}`}
                                className="mt-2 block text-sm text-zinc-200 hover:text-white line-clamp-2"
                              >
                                {t.name}
                              </Link>
                            </div>
                          ))}
                        </div>

                        <div className="mt-10 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-40"
                          >
                            ←
                          </button>
                          <span className="text-zinc-400 text-sm">Página {page}</span>
                          <button
                            type="button"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={!hasMore || gridLoading}
                            className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-40"
                          >
                            →
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
