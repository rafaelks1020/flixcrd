"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PremiumNavbar from "@/components/ui/PremiumNavbar";
import TitleRow from "@/components/ui/TitleRow";

type Category = "movie" | "serie" | "anime";

type Sort = "most_watched" | "most_liked" | "most_voted" | "newest";

interface Genre {
  id: number;
  name: string;
}

interface LabTitle {
  id: string;
  tmdbId: number;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  voteAverage: number;
  releaseDate: string | null;
  type: "MOVIE" | "SERIES";
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
  const [category, setCategory] = useState<Category>("movie");
  const [sort, setSort] = useState<Sort>("most_watched");
  const [year, setYear] = useState("");
  const [genre, setGenre] = useState("");

  const [genres, setGenres] = useState<Genre[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<LabTitle[]>([]);

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
        setResults(list);
      } catch (e) {
        console.error(e);
        setError("Erro ao carregar catálogo");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [queryString]);

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
    if (!results || results.length === 0) return null;
    const withBackdrop = results.find((r) => Boolean(r.backdropUrl));
    return withBackdrop || results[0];
  }, [results]);

  function openHero() {
    if (!heroTitle) return;
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
                    className="px-4 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700 text-white"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="text-zinc-400">Carregando...</div>
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : results.length === 0 ? (
              <div className="text-zinc-400">Nenhum item encontrado com esses filtros.</div>
            ) : (
              <TitleRow
                title={titleForRow}
                titles={results.map((t) => ({
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
          </div>
        </div>
      </div>
    </div>
  );
}
