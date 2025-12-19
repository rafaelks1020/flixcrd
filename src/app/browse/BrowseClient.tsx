"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import PremiumNavbar from "@/components/ui/PremiumNavbar";
import PremiumTitleCard from "@/components/ui/PremiumTitleCard";
import { Search, SlidersHorizontal, ArrowUpDown, LayoutGrid, Ghost } from "lucide-react";
import { cn } from "@/lib/utils";

interface Title {
  id: string;
  name: string;
  posterUrl: string | null;
  backdropUrl?: string | null;
  type: string;
  voteAverage?: number | null;
  releaseDate?: string | null;
  genres?: { name: string }[];
}

interface BrowseClientProps {
  initialTitles: Title[];
  isLoggedIn: boolean;
  isAdmin: boolean;
}

const PAGE_SIZE = 48;

export default function BrowseClient({
  initialTitles,
  isLoggedIn,
  isAdmin,
}: BrowseClientProps) {
  const [titles, setTitles] = useState<Title[]>(initialTitles);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("popularity");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const loadTitles = useCallback(async (pageToLoad: number, reset: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.append("type", filterType);
      if (sortBy) params.append("sort", sortBy);
      if (searchQuery) params.append("q", searchQuery);
      params.append("page", String(pageToLoad));
      params.append("limit", String(PAGE_SIZE));

      const res = await fetch(`/api/titles?${params.toString()}`);
      if (!res.ok) return;

      const json = await res.json();
      const list: Title[] = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
          ? json.data
          : [];

      setTitles((prev) => (reset ? list : [...prev, ...list]));
      setPage(pageToLoad);
      setHasMore(list.length === PAGE_SIZE);
    } catch (error) {
      console.error("Erro ao carregar títulos:", error);
    } finally {
      setLoading(false);
    }
  }, [filterType, sortBy, searchQuery]);

  useEffect(() => {
    loadTitles(1, true);
  }, [loadTitles]);

  useEffect(() => {
    if (!hasMore || loading) return;

    const node = observerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadTitles(page + 1, false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, page, loadTitles]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <main className="max-w-[1700px] mx-auto px-4 md:px-12 pt-28 pb-20">
        {/* Header Section */}
        <header className="mb-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-zinc-500">
                Catálogo
              </h1>
              <p className="text-zinc-500 max-w-xl font-medium">
                Explore nossa biblioteca completa de filmes, séries e animes.
                Filtre por categoria ou popularidade para encontrar sua próxima obsessão.
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm font-bold text-zinc-500 bg-zinc-900/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 shadow-xl">
              <LayoutGrid size={16} className="text-primary" />
              <span>{titles.length} Títulos Disponíveis</span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Search Input */}
            <div className="relative w-full lg:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, elenco ou gênero..."
                className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all backdrop-blur-md shadow-2xl"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative group">
                <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-zinc-900/50 border border-white/10 rounded-xl py-3.5 pl-11 pr-10 text-sm font-semibold text-white focus:outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer backdrop-blur-md hover:bg-zinc-800/80"
                >
                  <option value="ALL">Todos os Tipos</option>
                  <option value="MOVIE">Filmes</option>
                  <option value="SERIES">Séries</option>
                  <option value="ANIME">Animes</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
              </div>

              <div className="relative group">
                <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-zinc-900/50 border border-white/10 rounded-xl py-3.5 pl-11 pr-10 text-sm font-semibold text-white focus:outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer backdrop-blur-md hover:bg-zinc-800/80"
                >
                  <option value="popularity">Mais Populares</option>
                  <option value="recent">Mais Recentes</option>
                  <option value="rating">Melhor Avaliados</option>
                  <option value="name">Nome (A-Z)</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
              </div>
            </div>
          </div>
        </header>

        {/* Content Grid */}
        {titles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-14">
            {titles.map((title) => (
              <PremiumTitleCard
                key={title.id}
                id={title.id}
                name={title.name}
                posterUrl={title.posterUrl}
                type={title.type}
                rating={title.voteAverage || undefined}
                year={title.releaseDate ? new Date(title.releaseDate).getFullYear() : undefined}
                genres={title.genres?.map(g => g.name)}
              />
            ))}
          </div>
        ) : !loading ? (
          <div className="flex flex-col items-center justify-center py-40 text-center animate-fade-in">
            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
              <Ghost size={48} className="text-zinc-700" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Nenhum título encontrado</h3>
            <p className="text-zinc-500 max-w-md">
              Não conseguimos encontrar nada com esses filtros.
              Tente buscar por termos mais genéricos ou mudar a categoria.
            </p>
            <button
              onClick={() => { setSearchQuery(""); setFilterType("ALL"); }}
              className="mt-8 px-6 py-2 bg-white text-black rounded-lg font-bold hover:bg-zinc-200 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        ) : null}

        {/* Loading State Skeleton Grid */}
        {loading && titles.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
            {[...Array(14)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-[2/3] bg-zinc-900 rounded-lg animate-pulse" />
                <div className="h-4 bg-zinc-900 rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-zinc-900 rounded w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* More loader for infinite scroll */}
        {hasMore && (
          <div ref={observerRef} className="h-20 flex items-center justify-center mt-10">
            {loading && (
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ChevronDown({ className, size }: { className?: string, size?: number }) {
  return (
    <svg
      className={className}
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
