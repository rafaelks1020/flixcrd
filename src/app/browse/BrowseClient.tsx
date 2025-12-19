"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PremiumNavbar from "@/components/ui/PremiumNavbar";
import PremiumTitleCard from "@/components/ui/PremiumTitleCard";
import BrowseHero from "@/components/ui/BrowseHero";
import GenreBar from "@/components/ui/GenreBar";
import { Search, LayoutGrid, Ghost, Loader2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Title {
  id: string;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  type: string;
  voteAverage?: number | null;
  releaseDate?: string | null;
  overview: string | null;
  genres?: { genre: { id: string, name: string } }[];
}

interface Genre {
  id: string;
  name: string;
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
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Featured title is the first one by default (most popular)
  const featuredTitle = useMemo(() => titles[0] ?? null, [titles]);

  // Load Genres
  useEffect(() => {
    fetch("/api/genres")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setGenres(data);
      })
      .catch(err => console.error("Erro ao carregar gêneros:", err));
  }, []);

  const loadTitles = useCallback(async (pageToLoad: number, reset: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.append("type", filterType);
      if (selectedGenreId) params.append("genre", selectedGenreId);
      if (searchQuery) params.append("q", searchQuery);
      params.append("page", String(pageToLoad));
      params.append("limit", String(PAGE_SIZE));

      const res = await fetch(`/api/titles?${params.toString()}`);
      if (!res.ok) return;

      const json = await res.json();
      const list: Title[] = Array.isArray(json.data) ? json.data : [];

      setTitles((prev) => (reset ? list : [...prev, ...list]));
      setPage(pageToLoad);
      setHasMore(list.length === PAGE_SIZE);
    } catch (error) {
      console.error("Erro ao carregar títulos:", error);
    } finally {
      setLoading(false);
    }
  }, [filterType, selectedGenreId, searchQuery]);

  // Handle filter changes with reset
  useEffect(() => {
    loadTitles(1, true);
  }, [filterType, selectedGenreId, searchQuery, loadTitles]);

  // Infinite Scroll Intersection Observer
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
    return () => observer.disconnect();
  }, [hasMore, loading, page, loadTitles]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {/* Hero Section */}
      {!searchQuery && !selectedGenreId && filterType === "ALL" && featuredTitle && (
        <BrowseHero title={featuredTitle} />
      )}

      <main className={cn(
        "max-w-[1700px] mx-auto px-4 md:px-12 pb-20",
        (!searchQuery && !selectedGenreId && filterType === "ALL") ? "pt-10" : "pt-28"
      )}>
        {/* Controls Section */}
        <header className="mb-12 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white uppercase">
                {searchQuery ? `Resultados para "${searchQuery}"` : "Catálogo"}
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur-md rounded-full border border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <LayoutGrid size={14} className="text-primary" />
                  <span>{titles.length} Títulos</span>
                </div>
                {/* Type Filters */}
                <div className="flex bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/5">
                  {["ALL", "MOVIE", "SERIES", "ANIME"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                        filterType === t ? "bg-white text-black shadow-lg" : "text-zinc-600 hover:text-white"
                      )}
                    >
                      {t === "ALL" ? "Tudo" : t === "MOVIE" ? "Filmes" : t === "SERIES" ? "Séries" : "Animes"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome ou palavras-chave..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary/50 transition-all backdrop-blur-xl shadow-2xl"
              />
            </div>
          </div>

          {/* Genre Selection Bar */}
          <div className="border-t border-white/5 pt-2">
            <GenreBar
              genres={genres}
              selectedId={selectedGenreId}
              onSelect={setSelectedGenreId}
            />
          </div>
        </header>

        {/* Content Grid with Staggered Animations */}
        <AnimatePresence mode="popLayout">
          {titles.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-14"
            >
              {titles.map((title, index) => (
                <motion.div
                  key={title.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.5) }}
                >
                  <PremiumTitleCard
                    id={title.id}
                    name={title.name}
                    posterUrl={title.posterUrl}
                    type={title.type}
                    rating={title.voteAverage || undefined}
                    year={title.releaseDate ? new Date(title.releaseDate).getFullYear() : undefined}
                    genres={title.genres?.map(g => g.genre.name)}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : !loading ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-40 text-center"
            >
              <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl text-zinc-700">
                <Ghost size={48} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Vazio Absoluto</h3>
              <p className="text-zinc-600 max-w-md text-sm font-medium">
                Não detectamos nenhum título com esses filtros. Tente uma busca menos específica ou mude a categoria.
              </p>
              <button
                onClick={() => { setSearchQuery(""); setFilterType("ALL"); setSelectedGenreId(null); }}
                className="mt-8 px-10 py-3 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-xl"
              >
                Resetar Filtros
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Loading Skeletons */}
        {loading && titles.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
            {[...Array(14)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-[2/3] bg-zinc-900 rounded-2xl animate-pulse border border-white/5" />
                <div className="h-3 bg-zinc-900 rounded-full w-3/4 animate-pulse ml-1" />
              </div>
            ))}
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        {hasMore && (
          <div ref={observerRef} className="h-40 flex items-center justify-center mt-12">
            {loading && (
              <div className="flex items-center gap-3 text-zinc-500">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Escaneando Mais...</span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
