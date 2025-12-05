"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface TitleItem {
  id: string;
  name: string;
  posterUrl: string | null;
  type: string;
  voteAverage: number | null;
}

interface BrowseClientProps {
  initialTitles: TitleItem[];
}

export default function BrowseClient({ initialTitles }: BrowseClientProps) {
  const [titles, setTitles] = useState<TitleItem[]>(initialTitles);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialTitles.length >= 48);
  const [filter, setFilter] = useState<string>("all");
  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, page, filter]);

  async function loadMore() {
    setLoading(true);
    try {
      const url = new URL("/api/titles", window.location.origin);
      url.searchParams.set("page", String(page + 1));
      if (filter !== "all") {
        url.searchParams.set("type", filter);
      }

      const res = await fetch(url.toString());
      const newTitles: TitleItem[] = await res.json();

      if (newTitles.length > 0) {
        setTitles((prev) => [...prev, ...newTitles]);
        setPage((p) => p + 1);
        setHasMore(newTitles.length >= 24);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Erro ao carregar mais títulos", err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilterChange(newFilter: string) {
    setFilter(newFilter);
    setPage(1);
    setLoading(true);

    try {
      const url = new URL("/api/titles", window.location.origin);
      url.searchParams.set("page", "1");
      if (newFilter !== "all") {
        url.searchParams.set("type", newFilter);
      }

      const res = await fetch(url.toString());
      const newTitles: TitleItem[] = await res.json();

      setTitles(newTitles);
      setHasMore(newTitles.length >= 24);
    } catch (err) {
      console.error("Erro ao filtrar títulos", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen px-4 py-6 md:px-10 md:py-10">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Catálogo Completo</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {titles.length} {titles.length === 1 ? "título" : "títulos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100"
          >
            <span>←</span>
            <span>Voltar</span>
          </Link>
        </div>
      </header>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { value: "all", label: "Todos" },
          { value: "MOVIE", label: "Filmes" },
          { value: "SERIES", label: "Séries" },
          { value: "ANIME", label: "Animes" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => handleFilterChange(item.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              filter === item.value
                ? "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Grid de títulos */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        {titles.map((title) => (
          <Link
            key={title.id}
            href={`/title/${title.id}`}
            className="group relative overflow-hidden rounded-md bg-zinc-900 transition hover:scale-105 hover:z-10"
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
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[10px] leading-tight">
              <div className="line-clamp-2 font-semibold text-zinc-50">{title.name}</div>
              {title.voteAverage && (
                <div className="mt-0.5 flex items-center gap-0.5 text-yellow-400">
                  <span>★</span>
                  <span>{title.voteAverage.toFixed(1)}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={observerRef} className="mt-8 flex justify-center py-4">
          {loading ? (
            <div className="text-sm text-zinc-500">Carregando mais títulos...</div>
          ) : (
            <div className="h-4" />
          )}
        </div>
      )}

      {!hasMore && titles.length > 0 && (
        <div className="mt-8 text-center text-sm text-zinc-500">
          Todos os títulos foram carregados
        </div>
      )}

      {titles.length === 0 && !loading && (
        <div className="mt-12 text-center text-sm text-zinc-500">
          Nenhum título encontrado
        </div>
      )}
    </section>
  );
}
