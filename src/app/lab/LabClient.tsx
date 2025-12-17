"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import PremiumNavbar from "@/components/ui/PremiumNavbar";
import TitleRow from "@/components/ui/TitleRow";
import { SkeletonRow } from "@/components/ui/SkeletonCard";

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

  const [filmes, setFilmes] = useState<LabTitle[]>([]);
  const [series, setSeries] = useState<LabTitle[]>([]);
  const [animes, setAnimes] = useState<LabTitle[]>([]);
  const [loading, setLoading] = useState(true);

  const [heroTitle, setHeroTitle] = useState<HeroTitle | null>(null);

  // Busca com persistência
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LabTitle[]>([]);
  const [searching, setSearching] = useState(false);

  // Restaurar busca do localStorage ao carregar
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedQuery = localStorage.getItem("lab_search_query");
      const savedResults = localStorage.getItem("lab_search_results");
      if (savedQuery) {
        setSearchQuery(savedQuery);
      }
      if (savedResults) {
        try {
          setSearchResults(JSON.parse(savedResults));
        } catch {}
      }
    }
  }, []);

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
    if (!searchQuery.trim()) {
      setSearchResults([]);
      localStorage.removeItem("lab_search_query");
      localStorage.removeItem("lab_search_results");
      return;
    }

    try {
      setSearching(true);
      const res = await fetch(`/api/lab/busca?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        setSearchResults(results);
        // Salvar no localStorage para persistência
        localStorage.setItem("lab_search_query", searchQuery.trim());
        localStorage.setItem("lab_search_results", JSON.stringify(results));
      }
    } catch (err) {
      console.error("Erro na busca:", err);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    localStorage.removeItem("lab_search_query");
    localStorage.removeItem("lab_search_results");
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
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
              <button
                onClick={handleSearch}
                disabled={searching}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red-500 transition-colors"
              >
                {searching ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
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
            {/* Resultados da Busca */}
            {searchResults.length > 0 && (
              <TitleRow
                title={`🔍 Resultados para "${searchQuery}"`}
                titles={searchResults.map((t) => ({
                  id: t.id,
                  name: t.name,
                  href: `/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}`,
                  posterUrl: t.posterUrl,
                  type: t.type,
                  voteAverage: t.voteAverage,
                  releaseDate: t.releaseDate,
                }))}
              />
            )}

            {filmes.length > 0 && (
              <TitleRow
                title="🎬 Filmes"
                titles={filmes.map((t) => ({
                  id: t.id,
                  name: t.name,
                  href: `/lab/title/${t.tmdbId}?type=movie`,
                  posterUrl: t.posterUrl,
                  type: t.type,
                  voteAverage: t.voteAverage,
                  releaseDate: t.releaseDate,
                }))}
              />
            )}

            {series.length > 0 && (
              <TitleRow
                title="📺 Séries"
                titles={series.map((t) => ({
                  id: t.id,
                  name: t.name,
                  href: `/lab/title/${t.tmdbId}?type=tv`,
                  posterUrl: t.posterUrl,
                  type: t.type,
                  voteAverage: t.voteAverage,
                  releaseDate: t.releaseDate,
                }))}
              />
            )}

            {animes.length > 0 && (
              <TitleRow
                title="🎌 Animes"
                titles={animes.map((t) => ({
                  id: t.id,
                  name: t.name,
                  href: `/lab/title/${t.tmdbId}?type=tv`,
                  posterUrl: t.posterUrl,
                  type: t.type,
                  voteAverage: t.voteAverage,
                  releaseDate: t.releaseDate,
                }))}
              />
            )}

            {filmes.length === 0 && series.length === 0 && animes.length === 0 && (
              <div className="text-center py-16 text-zinc-500">
                Nenhum conteúdo disponível no momento.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
