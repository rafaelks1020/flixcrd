"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/ui/Navbar";
import TitleCard from "@/components/ui/TitleCard";
import SearchBar from "@/components/ui/SearchBar";
import SkeletonCard from "@/components/ui/SkeletonCard";
import Toast from "@/components/ui/Toast";

interface Title {
  id: string;
  name: string;
  posterUrl: string | null;
  backdropUrl?: string | null;
  type: string;
  voteAverage?: number | null;
  releaseDate?: string | null;
}

interface BrowseClientNewProps {
  initialTitles: Title[];
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export default function BrowseClientNew({
  initialTitles,
  isLoggedIn,
  isAdmin,
}: BrowseClientNewProps) {
  const [titles, setTitles] = useState<Title[]>(initialTitles);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("popularity");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadTitles();
  }, [filterType, sortBy, searchQuery]);

  const loadTitles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.append("type", filterType);
      if (sortBy) params.append("sort", sortBy);
      if (searchQuery) params.append("q", searchQuery);

      const res = await fetch(`/api/titles?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTitles(data);
      }
    } catch (error) {
      console.error("Erro ao carregar títulos:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Toast />
      <Navbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <div className="mx-auto max-w-7xl px-4 pt-24 pb-16 md:px-8">
        {/* Header */}
        <div className="mb-8 space-y-6">
          <h1 className="text-4xl font-bold text-white">Catálogo</h1>

          {/* Search */}
          <SearchBar
            initialQuery={searchQuery}
            onSearch={(query) => setSearchQuery(query)}
          />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/50"
            >
              <option value="ALL">Todos os Tipos</option>
              <option value="MOVIE">Filmes</option>
              <option value="SERIES">Séries</option>
              <option value="ANIME">Animes</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/50"
            >
              <option value="popularity">Mais Populares</option>
              <option value="recent">Mais Recentes</option>
              <option value="rating">Melhor Avaliados</option>
              <option value="name">Nome (A-Z)</option>
            </select>

            {/* Results Count */}
            <span className="ml-auto text-sm text-zinc-400">
              {titles.length} título{titles.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(18)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : titles.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {titles.map((title) => (
              <TitleCard key={title.id} {...title} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="mb-4 h-16 w-16 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-white">Nenhum título encontrado</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Tente ajustar os filtros ou fazer uma nova busca
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
