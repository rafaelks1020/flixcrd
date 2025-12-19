"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Calendar, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

import PremiumNavbar from "@/components/ui/PremiumNavbar";
import PremiumCalendarCard from "@/components/ui/PremiumCalendarCard";

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

// CalendarioHeroSection removed (inlined)

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
    <div className="min-h-screen bg-black font-sans selection:bg-red-500/30">
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {heroItem && (
        <div className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden group">
          <div className="absolute inset-0">
            {heroItem.backdropPath && (
              <img
                src={tmdbImageUrl(heroItem.backdropPath, "original") || ""}
                alt={heroItem.title}
                className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[10s] ease-out"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
            <div className="absolute inset-0 bg-black/20" />
          </div>

          <div className="absolute inset-0 flex flex-col justify-end px-4 md:px-12 pb-24 md:pb-32 max-w-[1700px] mx-auto w-full">
            <div className="max-w-3xl space-y-6 animate-in slide-in-from-left-10 fade-in duration-1000">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-sm text-white shadow-lg backdrop-blur-md border border-white/10",
                  heroItem.status === "Hoje" ? "bg-red-600 border-red-500" : "bg-zinc-800"
                )}>
                  {heroItem.status}
                </span>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 backdrop-blur-md rounded-md border border-white/10">
                  <Clock size={12} className="text-zinc-300" />
                  <span className="text-[10px] font-black text-white">
                    {heroItem.airDate ? new Date(heroItem.airDate).toLocaleDateString("pt-BR") : "Em breve"}
                  </span>
                </div>
              </div>

              <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white uppercase leading-[0.8] drop-shadow-2xl">
                {heroItem.title}
              </h1>

              <div className="flex flex-col gap-1">
                <h2 className="text-xl md:text-2xl font-bold text-primary tracking-tight uppercase">
                  {formatEpisodeLine(heroItem)}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => handleWatch(heroItem)}
                  className="h-12 md:h-14 px-8 md:px-12 bg-white text-black rounded-xl font-black uppercase text-xs md:text-sm tracking-[0.2em] flex items-center gap-3 hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/10"
                >
                  <Play size={20} fill="currentColor" />
                  Assistir Agora
                </button>

                <button
                  onClick={() => router.push(`/lab/title/${heroItem.tmdbId}?type=tv`)}
                  className="h-12 md:h-14 px-8 md:px-12 bg-zinc-900/80 backdrop-blur-xl text-white border border-white/10 rounded-xl font-black uppercase text-xs md:text-sm tracking-[0.2em] flex items-center gap-3 hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95 shadow-2xl"
                >
                  Mais Infos
                </button>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black to-transparent pointer-events-none" />
        </div>
      )}

      <div className={cn("relative z-10 px-4 md:px-12 pb-24 max-w-[1800px] mx-auto", heroItem ? "-mt-20" : "pt-24")}>

        {/* Filters & Search - Glassmorphism */}
        <div className="mb-12 sticky top-24 z-40 bg-black/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl flex flex-col xl:flex-row gap-6 items-center justify-between">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide w-full xl:w-auto pb-2 xl:pb-0">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                statusFilter === "ALL"
                  ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                  : "bg-zinc-900/50 text-zinc-400 border-white/5 hover:bg-zinc-800 hover:text-white hover:border-white/20"
              )}
            >
              Todos
            </button>
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                  statusFilter === st
                    ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    : "bg-zinc-900/50 text-zinc-400 border-white/5 hover:bg-zinc-800 hover:text-white hover:border-white/20"
                )}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full xl:w-[400px] group">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="FILTRAR POR TÍTULO..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-3 pl-12 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold uppercase tracking-wider placeholder:text-zinc-600"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <h3 className="text-xl font-bold text-red-500 mb-2">Erro ao carregar</h3>
              <p className="text-zinc-500">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 opacity-50">
              <Calendar size={48} className="mx-auto mb-4 text-zinc-600" />
              <p className="text-zinc-400 font-bold uppercase tracking-widest">Nenhum evento encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-12">
              {filtered.map((it, idx) => (
                <PremiumCalendarCard
                  key={`${it.tmdbId}-${it.seasonNumber}-${it.episodeNumber}-${idx}`} // Added idx for safety
                  tmdbId={it.tmdbId}
                  seasonNumber={it.seasonNumber}
                  episodeNumber={it.episodeNumber}
                  title={it.title}
                  episodeTitle={it.episodeTitle}
                  posterUrl={tmdbImageUrl(it.posterPath, "w780")}
                  airDate={it.airDate}
                  status={it.status}
                  onWatch={() => handleWatch(it)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
