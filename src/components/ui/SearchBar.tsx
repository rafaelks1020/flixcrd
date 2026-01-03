"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SearchResult {
  id: string;
  name: string;
  posterUrl: string | null;
  type: string;
  releaseDate: string | null;
}

interface SearchBarProps {
  initialQuery?: string;
  onSearch?: (query: string) => void;
}

export default function SearchBar({ initialQuery = "", onSearch }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/titles?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json) ? json : (json?.data || []);
          setResults(data.slice(0, 6)); // Limit to 6 results
          setShowResults(true);
        }
      } catch (error) {
        console.error("Erro na busca:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowResults(false);
      if (onSearch) {
        onSearch(query);
      } else {
        router.push(`/browse?q=${encodeURIComponent(query)}`);
      }
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar títulos, gêneros..."
          className="w-full rounded-full border border-zinc-700 bg-zinc-900/90 backdrop-blur-sm px-5 py-3 pl-12 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all"
        />
        <svg
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-red-600" />
          </div>
        )}
      </form>

      {/* Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950/98 backdrop-blur-md shadow-2xl overflow-hidden">
          <div className="p-2 space-y-1">
            {results.map((result) => (
              <Link
                key={result.id}
                href={`/title/${result.id}`}
                onClick={() => setShowResults(false)}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-zinc-800/80 transition-colors group"
              >
                {result.posterUrl ? (
                  <img
                    src={result.posterUrl}
                    alt={result.name}
                    className="h-16 w-11 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-11 items-center justify-center rounded bg-zinc-800 text-zinc-500">
                    🎬
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate group-hover:text-red-400 transition-colors">
                    {result.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="uppercase">{result.type}</span>
                    {result.releaseDate && (
                      <>
                        <span>•</span>
                        <span>{new Date(result.releaseDate).getFullYear()}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="border-t border-zinc-800 p-2">
            <button
              onClick={() => {
                setShowResults(false);
                router.push(`/browse?q=${encodeURIComponent(query)}`);
              }}
              className="w-full rounded-md py-2 text-center text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-colors"
            >
              Ver todos os resultados →
            </button>
          </div>
        </div>
      )}

      {showResults && results.length === 0 && !loading && query.trim().length >= 2 && (
        <div className="absolute top-full mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950/98 backdrop-blur-md shadow-2xl p-4 text-center text-sm text-zinc-500">
          Nenhum resultado encontrado para &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
