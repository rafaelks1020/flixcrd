"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Calendar,
  LayoutGrid,
  Search,
  X,
  Loader2,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  History,
  Clock,
  Mic,
  Brain,
  ChevronRight,
  Film,
  Tv,
  Cpu,
  Zap,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import PremiumNavbar from "@/components/ui/PremiumNavbar";
import PremiumHero from "@/components/ui/PremiumHero";
import PremiumTitleRow from "@/components/ui/PremiumTitleRow";
import TitleCard from "@/components/ui/TitleCard";
import { SkeletonRow } from "@/components/ui/SkeletonCard";
import { getLabContinue, getLabMyList, getLabWatchLater } from "./labStorage";
import { cn } from "@/lib/utils";

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

function DigitalRain() {
  const symbols = "0101010101010101010101010101010101010101010101010101010101010101";
  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.07] pointer-events-none">
      <div className="absolute inset-0 flex justify-around">
        {Array.from({ length: 32 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -500 }}
            animate={{ y: '100vh' }}
            transition={{
              duration: Math.random() * 5 + 3,
              repeat: Infinity,
              ease: "linear",
              delay: Math.random() * 5
            }}
            className="flex flex-col text-[8px] font-mono text-primary leading-none"
          >
            {symbols.split("").map((s, idx) => (
              <span key={idx} className="block">{s}</span>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function NeuralScanHUD({ query }: { query: string }) {
  const [dots, setDots] = useState("");
  const [currentLine, setCurrentLine] = useState(0);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(d => (d.length >= 3 ? "" : d + "."));
    }, 400);
    const lineInterval = setInterval(() => {
      setCurrentLine(l => (l + 1) % telemetryLines.length);
    }, 1500);
    return () => {
      clearInterval(dotInterval);
      clearInterval(lineInterval);
    };
  }, []);

  const telemetryLines = [
    "LINKING_NEURAL_INTERFACE_V4.0.2",
    "ESTABLISHING_ENTROPY_LINK...",
    "ACCESSING_GEMINI_FLASH_CORES...",
    "EXTRACTING_SEMANTIC_VECTOR_SPACE...",
    "MATCHING_USER_INTENT_PATTERNS...",
    "SYNTHESIZING_DYNAMIC_RESULTS...",
    "OPTIMIZING_QUANTUM_BUFFERS..."
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 overflow-hidden"
    >
      <div className="absolute top-1/2 left-0 w-full h-px bg-primary/30 shadow-[0_0_100px_rgba(220,38,38,0.8)] blur-[2px] opacity-50" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-radial-gradient from-primary/5 via-transparent to-transparent opacity-30" />
      <DigitalRain />
      <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
        <pattern id="neural-grid" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" className="text-primary" />
          <line x1="2" y1="2" x2="100" y2="100" stroke="currentColor" strokeWidth="0.1" className="text-primary" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#neural-grid)" />
      </svg>
      <div className="relative w-full max-w-5xl flex flex-col items-center justify-center min-h-[500px]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="absolute w-[450px] h-[450px] border-[0.5px] border-primary/10 rounded-full" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute w-[400px] h-[400px] border-[1px] border-dashed border-primary/20 rounded-full" />
        <div className="relative z-10 flex flex-col items-center">
          <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="w-72 h-72 border-[1.5px] border-primary/40 rounded-full flex items-center justify-center relative bg-gradient-to-tr from-primary/5 to-transparent backdrop-blur-sm">
            <div className="absolute inset-2 border-[1px] border-primary/20 rounded-full animate-ping" />
            <Brain size={80} className="text-primary drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]" />
            <motion.div animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute left-0 right-0 h-0.5 bg-primary/60 shadow-[0_0_10px_rgba(220,38,38,0.5)] z-20" />
          </motion.div>
          <div className="mt-16 space-y-6 text-center max-w-2xl relative">
            <motion.h3 initial={{ letterSpacing: "1em", opacity: 0 }} animate={{ letterSpacing: "0.4em", opacity: 1 }} className="text-white font-black uppercase text-2xl tracking-[0.4em] drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">Sincronia Neural{dots}</motion.h3>
            <div className="flex flex-col items-center gap-2">
              <div className="h-0.5 w-64 bg-zinc-900 overflow-hidden rounded-full">
                <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-1/2 h-full bg-primary" />
              </div>
              <div className="text-primary font-mono text-[9px] uppercase tracking-[0.3em] font-black">{telemetryLines[currentLine]}</div>
            </div>
            <div className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-[10px] bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-2 rounded-full">PROCESSO: "{query}"</div>
          </div>
        </div>
        <div className="absolute top-10 left-10 text-left font-mono pointer-events-none">
          <div className="text-[10px] text-zinc-700 flex items-center gap-2"><Activity size={12} className="text-primary animate-pulse" />CORE_TEMP: <span className="text-emerald-500">42°C</span></div>
          <div className="text-[10px] text-zinc-700 mt-1">LATENCY: <span className="text-primary">12ms</span></div>
        </div>
        <div className="absolute bottom-10 right-10 text-right font-mono pointer-events-none">
          <div className="text-[10px] text-zinc-700">ENCRYPTION: <span className="text-primary">AES-256-GCM</span></div>
          <div className="text-[10px] text-zinc-800 mt-1">© PFLIX_SYSTEMS_2025</div>
        </div>
      </div>
      <div className="absolute inset-0 border-[40px] border-black/80 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_rgba(220,38,38,0.8)]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_rgba(220,38,38,0.8)]" />
    </motion.div>
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
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<LabTitle[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const tmdbType = category === "movie" ? "movie" : "tv";

  async function runAiRecommendations() {
    const q = aiQuery.trim();
    if (q.length < 6) { setAiError("Escreva um pouco mais para a IA entender seu gosto."); return; }
    setAiError(null); setAiLoading(true); setAiResults([]);
    try {
      const res = await fetch("/api/lab/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q, limit: 48 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (typeof json?.nextAllowedAt === "string") {
          const next = new Date(json.nextAllowedAt);
          const when = Number.isFinite(next.getTime()) ? next.toLocaleString() : json.nextAllowedAt;
          setAiError(`${typeof json?.error === "string" ? json.error : "Limite atingido."} Próxima liberação: ${when}`);
        } else { setAiError(typeof json?.error === "string" ? json.error : "Erro ao gerar recomendações."); }
        return;
      }
      const list = Array.isArray(json?.results) ? (json.results as any[]) : [];
      const mapped: LabTitle[] = list.map((it: any) => ({
        id: typeof it?.id === "string" ? it.id : String(it?.tmdbId ?? it?.id ?? ""),
        tmdbId: typeof it?.tmdbId === "number" ? it.tmdbId : undefined,
        imdbId: null,
        name: typeof it?.name === "string" ? it.name : "Sem título",
        posterUrl: typeof it?.posterUrl === "string" ? it.posterUrl : null,
        backdropUrl: typeof it?.backdropUrl === "string" ? it.backdropUrl : null,
        overview: typeof it?.overview === "string" ? it.overview : "",
        voteAverage: typeof it?.voteAverage === "number" ? it.voteAverage : null,
        releaseDate: typeof it?.releaseDate === "string" ? it.releaseDate : null,
        type: typeof it?.type === "string" ? it.type : "MOVIE",
      })).filter((t: LabTitle) => Boolean(t.tmdbId));
      setAiResults(dedupeLabTitles(mapped));
    } catch { setAiError("Erro ao gerar recomendações."); } finally { setAiLoading(false); }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedQuery = localStorage.getItem("lab_search_query");
      if (savedQuery) { setSearchQuery(savedQuery); }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const load = () => { setLabContinue(getLabContinue()); setLabMyList(getLabMyList()); setLabWatchLater(getLabWatchLater()); };
    load();
    const onVisibility = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    async function loadGenres() {
      try {
        const res = await fetch(`/api/lab/tmdb/genres?type=${tmdbType}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setGenres(Array.isArray(data?.genres) ? data.genres : []);
      } catch { }
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
        setGridLoading(true); setGridError(null);
        const res = await fetch(`/api/lab/discover?${discoverQueryString}`, { cache: "no-store" });
        if (!res.ok) { setGridError("Erro ao carregar"); setGridResults([]); setHasMore(false); return; }
        const data = await res.json();
        setGridResults(dedupeLabTitles(Array.isArray(data?.results) ? data.results : []));
        setHasMore(Boolean(data?.hasMore));
      } catch { setGridError("Erro ao carregar catálogo"); setGridResults([]); setHasMore(false); } finally { setGridLoading(false); }
    }
    loadDiscover();
  }, [discoverQueryString, searchMode]);

  async function performSearch({ startPage, append }: { startPage: number; append: boolean }) {
    const query = searchQuery.trim();
    if (!query) { setSearchResults([]); setSearchError(null); setSearchNextPage(1); setSearchHasMore(false); localStorage.removeItem("lab_search_query"); return; }
    localStorage.setItem("lab_search_query", query);
    try {
      setSearching(true); setSearchError(null);
      if (searchAbortRef.current) searchAbortRef.current.abort();
      const controller = new AbortController(); searchAbortRef.current = controller;
      const res = await fetch(`/api/lab/busca?q=${encodeURIComponent(query)}&page=${startPage}&limit=24`, { signal: controller.signal });
      if (!res.ok) { setSearchError("Erro na busca"); setSearchHasMore(false); return; }
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      setSearchNextPage((typeof data?.tmdbPageEnd === "number" ? data.tmdbPageEnd : startPage) + 1);
      setSearchHasMore(Boolean(data?.hasMore));
      setSearchResults(prev => dedupeLabTitles(append ? [...prev, ...results] : results));
    } catch (err: any) { if (err?.name !== "AbortError") setSearchError("Erro na busca"); } finally { setSearching(false); }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    const query = searchQuery.trim();
    if (!query || query.length < 2) { setSearchResults([]); setSearchError(null); setSearchNextPage(1); setSearchHasMore(false); return; }
    searchDebounceRef.current = window.setTimeout(() => { performSearch({ startPage: 1, append: false }); }, 450);
    return () => { if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoading(true);
        const [fRes, sRes, aRes] = await Promise.allSettled([
          fetch(`/api/lab/catalogo?type=movie&limit=20`),
          fetch(`/api/lab/catalogo?type=serie&limit=20`),
          fetch(`/api/lab/catalogo?type=anime&limit=20`),
        ]);
        if (fRes.status === "fulfilled" && fRes.value.ok) {
          const d = await fRes.value.json(); setFilmes(d.items || []);
          if (d.items?.length > 0) {
            const h = d.items[Math.floor(Math.random() * Math.min(5, d.items.length))];
            setHeroTitle({ id: h.id, tmdbId: h.tmdbId, imdbId: h.imdbId, name: h.name, overview: h.overview || null, backdropUrl: h.backdropUrl, releaseDate: h.releaseDate, voteAverage: h.voteAverage, type: h.type });
          }
        }
        if (sRes.status === "fulfilled" && sRes.value.ok) { const d = await sRes.value.json(); setSeries(d.items || []); }
        if (aRes.status === "fulfilled" && aRes.value.ok) { const d = await aRes.value.json(); setAnimes(d.items || []); }
      } catch { } finally { setLoading(false); }
    }
    loadCatalog();
  }, []);

  const heroCarouselTitles = useMemo(() => {
    const base = filmes.length > 0 ? filmes : series.length > 0 ? series : animes;
    if (!base || base.length === 0) return [];
    const pool = base.filter(t => Boolean(t.backdropUrl)).slice(0, 8);
    return (pool.length > 0 ? pool : base.slice(0, 8)).map(t => ({ id: t.id, tmdbId: t.tmdbId, imdbId: t.imdbId, name: t.name, overview: t.overview || null, backdropUrl: t.backdropUrl, releaseDate: t.releaseDate, voteAverage: t.voteAverage, type: t.type }));
  }, [filmes, series, animes]);

  useEffect(() => {
    if (heroCarouselTitles.length === 0) return;
    const interval = window.setInterval(() => {
      setIsTransitioning(true);
      window.setTimeout(() => { setCurrentHeroIndex(p => (p + 1) % heroCarouselTitles.length); setIsTransitioning(false); }, 300);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [heroCarouselTitles]);

  const activePremiumHero = heroCarouselTitles[currentHeroIndex] || heroTitle;
  const premiumHeroInfoHref = useMemo(() => {
    if (!activePremiumHero?.tmdbId) return "/lab";
    return `/lab/title/${activePremiumHero.tmdbId}?type=${activePremiumHero.type === "MOVIE" ? "movie" : "tv"}`;
  }, [activePremiumHero]);
  const premiumHeroPlayHref = useMemo(() => {
    if (!activePremiumHero) return "/lab";
    if (activePremiumHero.type === "MOVIE") {
      if (activePremiumHero.imdbId) return `/lab/watch?type=filme&id=${activePremiumHero.imdbId}${activePremiumHero.tmdbId ? `&tmdb=${activePremiumHero.tmdbId}` : ""}`;
      return premiumHeroInfoHref;
    }
    if (activePremiumHero.tmdbId) return `/lab/watch?type=serie&id=${activePremiumHero.tmdbId}&season=1&episode=1&tmdb=${activePremiumHero.tmdbId}`;
    return premiumHeroInfoHref;
  }, [activePremiumHero, premiumHeroInfoHref]);

  const mapLabTitleToPremium = (t: LabTitle) => {
    const tmdbId = t.tmdbId ?? Number(t.id);
    const mediaType = t.type === "MOVIE" ? "movie" : "tv";
    return {
      id: labTitleKey(t),
      href: Number.isFinite(tmdbId) ? `/lab/title/${tmdbId}?type=${mediaType}` : "/lab",
      name: t.name, posterUrl: t.posterUrl, type: t.type, releaseDate: t.releaseDate, voteAverage: t.voteAverage,
    };
  };

  const gridTitle = useMemo(() => {
    const catLabel = category === "movie" ? "Filmes" : category === "serie" ? "Séries" : "Animes";
    const sortLabel = sort === "most_watched" ? "Mais assistidos" : sort === "most_liked" ? "Melhor avaliados" : sort === "most_voted" ? "Mais votados" : "Mais recentes";
    return `${catLabel} - ${sortLabel}`;
  }, [category, sort]);

  const filteredSearchResults = useMemo(() => {
    if (!searchMode) return searchResults;
    if (category === "movie") return searchResults.filter((t) => t.type === "MOVIE");
    return searchResults.filter((t) => t.type !== "MOVIE");
  }, [searchResults, searchMode, category]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-primary/30 flex flex-col relative">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
      <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        <AnimatePresence mode="wait">
          {activePremiumHero && (
            <motion.div key={activePremiumHero.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="relative">
              <PremiumHero title={activePremiumHero} isLoggedIn={isLoggedIn} playHref={premiumHeroPlayHref} infoHref={premiumHeroInfoHref} />
              {heroCarouselTitles.length > 1 && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 z-[20]">
                  {heroCarouselTitles.map((_, index) => (
                    <button key={index} onClick={() => setCurrentHeroIndex(index)} className={cn("h-1.5 rounded-full transition-all duration-300", currentHeroIndex === index ? "w-8 bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "w-2 bg-white/20 hover:bg-white/40")} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative -mt-8 z-30 pb-32 space-y-24 px-4 md:px-8">
          <AnimatePresence>{aiLoading && <NeuralScanHUD query={aiQuery} />}</AnimatePresence>
          <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-8">
            <div className="flex flex-col xl:flex-row gap-6 items-stretch">
              <div className="flex-[2]">
                <div className="group relative bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 md:p-8 transition-all hover:bg-white/[0.08] hover:border-white/20 shadow-2xl">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 relative w-full group/input">
                      <Brain className="absolute left-6 top-1/2 -translate-y-1/2 text-primary group-hover/input:scale-110 transition-transform duration-300 pointer-events-none" size={24} />
                      <input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runAiRecommendations()} placeholder="Descreva o que quer ver..." className="w-full h-16 bg-black/40 border border-white/5 rounded-2xl pl-16 pr-8 text-sm text-white focus:border-primary/50 outline-none transition-all placeholder:text-zinc-600 font-bold uppercase tracking-widest text-[11px]" />
                    </div>
                    <button onClick={runAiRecommendations} disabled={aiLoading} className="h-16 px-10 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-3 shrink-0 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                      {aiLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />} Explorar com IA
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-3">
                <Link href="/lab/calendario" className="flex-1 h-14 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all font-black uppercase tracking-widest text-[10px] group/btn"><Calendar size={18} className="text-primary group-hover/btn:scale-110 transition-transform" />Calendário</Link>
                <Link href="/lab/explore" className="flex-1 h-14 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all font-black uppercase tracking-widest text-[10px] group/btn"><TrendingUp size={18} className="text-emerald-500 group-hover/btn:scale-110 transition-transform" />Hot Now</Link>
              </div>
            </div>
            {aiError && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-red-500/5 p-3 rounded-xl border border-red-500/20"><X size={14} />{aiError}</motion.div>}
          </div>
          {searchMode ? (
            <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                <div className="space-y-1">
                  <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Resultados</h2>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2"><Search size={12} />Consulta: "{searchQuery}"</p>
                </div>
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/5">
                  {[{ id: "movie", label: "Filmes", icon: Film }, { id: "serie", label: "Séries", icon: Tv }, { id: "anime", label: "Animes", icon: Sparkles }].map((cat) => (
                    <button key={cat.id} onClick={() => setCategory(cat.id as Category)} className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", category === cat.id ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white hover:bg-white/5")}><cat.icon size={14} />{cat.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {filteredSearchResults.map((t) => (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={labTitleKey(t)}><TitleCard id={t.id} name={t.name} href={`/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}`} posterUrl={t.posterUrl} type={t.type} voteAverage={t.voteAverage} releaseDate={t.releaseDate} /></motion.div>
                ))}
              </div>
              {searchHasMore && <div className="flex justify-center pt-12"><button onClick={() => performSearch({ startPage: searchNextPage, append: true })} disabled={searching} className="h-14 px-12 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-zinc-200 transition-all flex items-center gap-3">{searching ? <Loader2 className="animate-spin" size={18} /> : <TrendingUp size={18} />}Explorar Mais</button></div>}
            </div>
          ) : (
            <>
              <AnimatePresence>{aiResults.length > 0 && (<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6"><div className="max-w-7xl mx-auto px-4 md:px-8 flex items-baseline justify-between border-l-2 border-primary pl-6"><h2 className="text-2xl font-black text-white uppercase tracking-tighter">Sintonizado com você</h2><button onClick={() => setAiResults([])} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white">Ocultar</button></div><PremiumTitleRow title="LAB AI Recommendations" titles={aiResults.map(mapLabTitleToPremium)} /></motion.div>)}</AnimatePresence>
              {labContinue.length > 0 && <PremiumTitleRow title="Continuar Assistindo" titles={labContinue.map(it => ({ id: it.key, href: it.watchUrl, name: it.title || "Continuar", posterUrl: it.posterUrl, type: it.watchType === "filme" ? "MOVIE" : "SERIES" }))} />}
              {labMyList.length > 0 && <PremiumTitleRow title="Sua Coleção Premium" titles={labMyList.map(it => ({ id: it.key, href: `/lab/title/${it.tmdbId}?type=${it.mediaType}`, name: it.title, posterUrl: it.posterUrl, type: it.type }))} />}
              <div className="space-y-20 pt-8">
                {filmes.length > 0 && (<div className="space-y-6"><div className="max-w-7xl mx-auto px-4 md:px-8 border-l-2 border-primary pl-6"><h2 className="text-2xl font-black text-white uppercase tracking-tighter">Obras Cinematográficas</h2><p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-1">Acervo Lab de Filmes</p></div><PremiumTitleRow title="Lab Movies" titles={filmes.map(mapLabTitleToPremium)} /></div>)}
                {series.length > 0 && (<div className="space-y-6"><div className="max-w-7xl mx-auto px-4 md:px-8 border-l-2 border-emerald-500 pl-6"><h2 className="text-2xl font-black text-white uppercase tracking-tighter">Produções em Série</h2><p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-1">Maratonas de Alta Performance</p></div><PremiumTitleRow title="Lab Series" titles={series.map(mapLabTitleToPremium)} /></div>)}
                {animes.length > 0 && (<div className="space-y-6"><div className="max-w-7xl mx-auto px-4 md:px-8 border-l-2 border-yellow-500 pl-6"><h2 className="text-2xl font-black text-white uppercase tracking-tighter">Intelectualidade Oriental</h2><p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-1">Animes e Cultura Pop</p></div><PremiumTitleRow title="Lab Animes" titles={animes.map(mapLabTitleToPremium)} /></div>)}
              </div>
              <div className="max-w-7xl mx-auto px-4 md:px-8 pt-20 space-y-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-12">
                  <div className="space-y-2">
                    <h2 className="text-5xl font-black text-white uppercase tracking-widest leading-none">Descobrir</h2>
                    <div className="flex items-center gap-4 text-zinc-500 text-[10px] font-black uppercase tracking-widest"><span className="flex items-center gap-1.5"><LayoutGrid size={14} className="text-primary" /> {gridTitle}</span><span className="text-zinc-800">•</span><span className="text-white bg-primary/20 px-2 py-0.5 rounded">MODO LAB Ativo</span></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/5 p-1 rounded-2xl">
                      {([["most_watched", "Hot"], ["most_liked", "Critica"], ["newest", "Recent"]] as Array<[Sort, string]>).map(([key, label]) => (
                        <button key={key} onClick={() => { setSort(key); setPage(1); }} className={cn("px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", sort === key ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>{label}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"><ArrowLeft size={18} /></button>
                      <div className="h-12 px-6 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center font-black text-[10px] uppercase tracking-widest text-zinc-400">Pag {page}</div>
                      <button disabled={!hasMore || gridLoading} onClick={() => setPage(p => p + 1)} className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"><ArrowRight size={18} /></button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto pb-4 scrollbar-hide"><div className="flex gap-2"><button onClick={() => { setGenre(""); setPage(1); }} className={cn("h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap", !genre ? "bg-white text-black border-white" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20 hover:text-white")}>Todos os Gêneros</button>{genres.map(g => (<button key={g.id} onClick={() => { setGenre(String(g.id)); setPage(1); }} className={cn("h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap", genre === String(g.id) ? "bg-white text-black border-white" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20 hover:text-white")}>{g.name}</button>))}</div></div>
                <div className="min-h-[400px] relative"><AnimatePresence mode="wait">{gridLoading ? (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 gap-6"><Loader2 size={40} className="text-primary animate-spin" /><p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 animate-pulse">Sintonizando Satélite</p></motion.div>) : gridResults.length === 0 ? (<div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-600 font-black uppercase text-[10px] tracking-widest"><LayoutGrid size={32} className="opacity-20" />Nenhum item indexado nestas coordenadas</div>) : (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">{gridResults.map(t => (<TitleCard key={labTitleKey(t)} id={t.id} name={t.name} href={`/lab/title/${t.tmdbId}?type=${t.type === "MOVIE" ? "movie" : "tv"}`} posterUrl={t.posterUrl} type={t.type} voteAverage={t.voteAverage} releaseDate={t.releaseDate} />))}</motion.div>)}</AnimatePresence></div>
                <div className="flex justify-center items-center gap-6 pt-10 border-t border-white/5"><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-8 h-12 rounded-xl bg-white/5 text-zinc-500 font-black uppercase tracking-widest text-[10px] hover:bg-white/10 hover:text-white transition-all disabled:opacity-30">Anterior</button><span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Lote {page}</span><button disabled={!hasMore || gridLoading} onClick={() => setPage((p) => p + 1)} className="px-8 h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-zinc-200 shadow-xl transition-all disabled:opacity-30">Próxima</button></div>
              </div>
            </>
          )}
        </div>
      </main>
      <footer className="relative z-[50] py-12 border-t border-white/5 bg-zinc-950/80 backdrop-blur-xl"><div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-6"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary"><Sparkles size={16} /></div><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pflix Lab v2.0 • Experimental Intelligence Hub</span></div><div className="flex gap-8 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700"><span className="hover:text-primary transition-colors cursor-pointer">Status Satélite: OK</span><span className="hover:text-primary transition-colors cursor-pointer">Environment: Production</span><span className="hover:text-primary transition-colors cursor-pointer" title="Motor de Inteligência Artificial: Google Gemini 1.5 Flash">Neural Engine: Gemini Flash</span></div></div></footer>
    </div>
  );
}
