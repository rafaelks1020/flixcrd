"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PremiumNavbar from "@/components/ui/PremiumNavbar";

type CalendarStatus = "Atualizado" | "Hoje" | "Futuro" | "Atrasado" | string;

interface CalendarItem {
  title: string;
  episodeTitle: string;
  episodeNumber: number;
  airDate: string;
  posterPath: string;
  backdropPath: string;
  seasonNumber: number;
  tmdbId: number;
  imdbId: string;
  status: CalendarStatus;
}

interface LabCalendarioClientProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

function normalizeItems(data: unknown): CalendarItem[] {
  if (Array.isArray(data)) return data as CalendarItem[];
  if (data && typeof data === "object") {
    const anyData = data as any;
    if (Array.isArray(anyData.items)) return anyData.items;
    if (Array.isArray(anyData.data)) return anyData.data;
    if (Array.isArray(anyData.results)) return anyData.results;
  }
  return [];
}

function safeText(v: any, fallback = "") {
  if (v === null || v === undefined) return fallback;
  const s = String(v);
  return s === "undefined" || s === "null" ? fallback : s;
}

function safeInt(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : parseInt(String(v || "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseAirDateToMs(airDate: string) {
  const s = (airDate || "").trim();
  if (!s) return Number.POSITIVE_INFINITY;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    const t = d.getTime();
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  }

  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    const d = new Date(yyyy, mm - 1, dd);
    const t = d.getTime();
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  }

  const d = new Date(s);
  const t = d.getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function formatEpisodeLine(it: CalendarItem) {
  const season = safeInt(it.seasonNumber, 0);
  const ep = safeInt(it.episodeNumber, 0);
  const epTitle = safeText(it.episodeTitle, "").trim();

  if (season > 0 && ep > 0) {
    const base = `S${String(season).padStart(2, "0")}E${String(ep).padStart(2, "0")}`;
    return epTitle ? `${base} — ${epTitle}` : base;
  }
  return epTitle || "";
}

function tmdbImageUrl(pathOrUrl: string | null | undefined, size: "w300" | "w780" | "original" = "w300") {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `https://image.tmdb.org/t/p/${size}${pathOrUrl}`;
}

function CalendarioHeroSection({
  item,
  onPlay,
  onMore,
}: {
  item: CalendarItem | null;
  onPlay: () => void;
  onMore: () => void;
}) {
  if (!item) return null;

  const backdrop = tmdbImageUrl(item.backdropPath, "original");
  const air = item.airDate ? new Date(item.airDate).toLocaleDateString("pt-BR") : "-";
  const episodeLine = formatEpisodeLine(item);

  return (
    <section className="relative h-[85vh] min-h-[600px] w-full overflow-hidden bg-black pt-16">
      <div className="absolute inset-0">
        {backdrop && (
          <>
            <img src={backdrop} alt={item.title} className="h-full w-full object-cover" loading="eager" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
          </>
        )}
      </div>

      <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-24 md:px-12 md:pb-32">
        <div className="max-w-2xl space-y-4 animate-fade-in">
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-2xl md:text-6xl lg:text-7xl">
            {item.title}
          </h1>

          <div className="flex items-center gap-3 text-sm text-zinc-200 md:text-base">
            <span className="font-semibold">{air}</span>
            <span>•</span>
            <span className="rounded bg-zinc-800/80 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold uppercase">
              {item.status}
            </span>
          </div>

          <p className="line-clamp-3 text-sm text-zinc-200 drop-shadow-lg md:text-base lg:line-clamp-4">
            {episodeLine || "Episódio"}
          </p>

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
                href="/lab/explore"
                className="rounded-full bg-zinc-900/70 border border-zinc-700 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800/80"
              >
                Explorar
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}

export default function LabCalendarioClient({ isLoggedIn, isAdmin }: LabCalendarioClientProps) {
  const router = useRouter();

  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | CalendarStatus>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/lab/calendario", { cache: "no-store" });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const message = data?.error ? String(data.error) : "Erro ao carregar calendário";
          setError(message);
          return;
        }

        const data = await res.json();
        setItems(normalizeItems(data));
      } catch (e) {
        console.error(e);
        setError("Erro ao carregar calendário");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it?.status) set.add(it.status);
    }
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => (statusFilter === "ALL" ? true : it.status === statusFilter))
      .filter((it) => {
        if (!q) return true;
        const hay = `${safeText(it.title)} ${safeText(it.episodeTitle)}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => parseAirDateToMs(a.airDate) - parseAirDateToMs(b.airDate));
  }, [items, statusFilter, query]);

  const heroItem = useMemo(() => {
    if (!items || items.length === 0) return null;
    const pick = items.find((it) => Boolean(it.backdropPath)) || items[0];
    return pick;
  }, [items]);

  const contentContainerClass = heroItem
    ? "relative z-10 -mt-32 space-y-8 pb-16 px-4"
    : "pt-20 space-y-8 pb-16 px-4";

  function handleWatch(it: CalendarItem) {
    router.push(
      `/lab/watch?type=serie&id=${it.tmdbId}&season=${it.seasonNumber || 1}&episode=${it.episodeNumber || 1}`,
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <CalendarioHeroSection
        item={heroItem}
        onPlay={() => {
          if (!heroItem) return;
          handleWatch(heroItem);
        }}
        onMore={() => {
          if (!heroItem) return;
          router.push(`/lab/title/${heroItem.tmdbId}?type=tv`);
        }}
      />

      <div className={contentContainerClass}>
        <div className="max-w-7xl mx-auto">
          <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex gap-2 flex-wrap items-center">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-4 py-2 rounded-full text-sm font-semibold border ${statusFilter === "ALL" ? "bg-red-600 border-red-500 text-white" : "bg-zinc-900/60 border-zinc-700 text-zinc-200 hover:bg-zinc-800/70"}`}
              >
                Todos
              </button>
              {statuses.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border ${statusFilter === st ? "bg-red-600 border-red-500 text-white" : "bg-zinc-900/60 border-zinc-700 text-zinc-200 hover:bg-zinc-800/70"}`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-[360px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar por título..."
                className="w-full px-5 py-3 rounded-full bg-zinc-900/90 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="text-zinc-400">Carregando calendário...</div>
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="text-zinc-400">Nenhum item encontrado.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((it, idx) => {
                  const poster = tmdbImageUrl(it.posterPath, "w300");
                  const air = it.airDate ? new Date(it.airDate).toLocaleDateString("pt-BR") : "-";
                  const episodeLine = formatEpisodeLine(it);

                  return (
                    <div
                      key={`${it.tmdbId}-${it.seasonNumber}-${it.episodeNumber}-${it.airDate}-${idx}`}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden"
                    >
                      <div className="flex gap-4 p-4">
                        <div className="w-20 h-28 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0">
                          {poster ? (
                            <img src={poster} alt={it.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">🎬</div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-white font-bold truncate">{it.title}</div>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-200 border border-zinc-700">
                              {it.status}
                            </span>
                          </div>

                          {episodeLine ? (
                            <div className="mt-1 text-sm text-zinc-300 line-clamp-2">{episodeLine}</div>
                          ) : null}

                          <div className="mt-2 text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                            <span>{air}</span>
                          </div>

                          <div className="mt-4 flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleWatch(it)}
                              className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
                            >
                              ▶ Assistir
                            </button>
                            <Link
                              href={`/lab/title/${it.tmdbId}?type=tv`}
                              className="px-4 py-2 rounded-full bg-zinc-900/70 border border-zinc-700 hover:bg-zinc-800/80 text-white text-sm font-semibold"
                            >
                              Detalhes
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
