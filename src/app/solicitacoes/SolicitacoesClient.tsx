"use client";

import { useEffect, useState } from "react";
import PremiumNavbar from "@/components/ui/PremiumNavbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Send,
  Film,
  Tv,
  Globe,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlusCircle,
  Users,
  MessageSquare,
  Sparkles,
  ChevronRight,
  TrendingUp,
  History,
  Info,
  Loader2,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RequestItem {
  id: string;
  title: string;
  type: string;
  imdbId?: string | null;
  status: string;
  workflowState: string;
  followersCount: number;
  desiredLanguages?: string | null;
  desiredQuality?: string | null;
  note?: string | null;
  imdbJson?: any;
  createdAt?: string;
}

interface TmdbResult {
  tmdbId: number;
  type: string;
  name: string;
  overview: string;
  releaseDate?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
}

interface SolicitacoesClientProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export default function SolicitacoesClient({ isLoggedIn, isAdmin }: SolicitacoesClientProps) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [mode, setMode] = useState<"tmdb" | "manual">("tmdb");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<TmdbResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TmdbResult | null>(null);
  const [tmdbSearched, setTmdbSearched] = useState(false);

  const [titleInput, setTitleInput] = useState("");
  const [type, setType] = useState<string>("MOVIE");
  const [languages, setLanguages] = useState<string[]>(["legendado"]);
  const [quality, setQuality] = useState<string>("1080p");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadRequests();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!error && !success) return;
    const timeout = setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 6000);
    return () => clearTimeout(timeout);
  }, [error, success]);

  async function loadRequests() {
    try {
      setLoadingRequests(true);
      const res = await fetch("/api/solicitacoes", { cache: "no-store" });
      if (res.ok) setRequests(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function handleSearchTmdb(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearchLoading(true);
      setError(null);
      const params = new URLSearchParams({ q: searchQuery.trim(), type: "multi" });
      const res = await fetch(`/api/tmdb/search?${params.toString()}`);
      if (!res.ok) throw new Error("Erro buscar");
      const data = await res.json();
      setSearchResults(data.results ?? []);
      setTmdbSearched(true);
    } catch (err) {
      setError("Erro ao buscar títulos.");
      setTmdbSearched(true);
    } finally {
      setSearchLoading(false);
    }
  }

  function toggleLanguage(value: string) {
    setLanguages((prev) =>
      prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);

    const finalTitle = (selectedResult?.name || titleInput).trim();
    if (!finalTitle) {
      setError("Informe um título.");
      return;
    }

    const body: any = {
      title: finalTitle,
      type,
      desiredLanguages: languages,
      desiredQuality: quality,
      note: note.trim() || null,
    };

    if (mode === "tmdb" && selectedResult) {
      body.imdbId = String(selectedResult.tmdbId);
      body.imdbJson = selectedResult;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        const existingId = data?.requestId as string;
        if (existingId) {
          await fetch(`/api/solicitacoes/${existingId}/seguir`, { method: "POST" });
          await loadRequests();
          setSuccess("Conteúdo já solicitado. Agora você é um seguidor!");
        }
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar");
      }

      const created = await res.json();
      setRequests((prev) => [created, ...prev]);
      setSuccess("Solicitação enviada com sucesso!");
      setNote("");
      if (mode === "manual") setTitleInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro crítico.");
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusLabel(status: string) {
    const map: Record<string, { label: string; color: string; icon: any }> = {
      PENDING: { label: "Pendente", color: "zinc", icon: Clock },
      UNDER_REVIEW: { label: "Em Análise", color: "blue", icon: Search },
      IN_PRODUCTION: { label: "Em Produção", color: "purple", icon: TrendingUp },
      COMPLETED: { label: "Concluído", color: "emerald", icon: CheckCircle2 },
      REJECTED: { label: "Recusado", color: "red", icon: AlertCircle },
    };
    return map[status] || { label: status, color: "zinc", icon: Info };
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 relative overflow-x-hidden">
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 via-black to-black" />
        <div className="absolute top-1/4 -right-1/4 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-[1400px] px-6 md:px-12 pt-28 md:pt-40 pb-20">

        {/* Hero Section */}
        <header className="mb-16 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 text-primary"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <span className="font-black uppercase tracking-[0.4em] text-xs">Request Hub</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight"
          >
            Sua vontade é <br className="hidden md:block" /> nossa ordem.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-500 text-lg md:text-xl font-medium max-w-2xl leading-relaxed"
          >
            Não encontrou o que queria? Peça novos filmes, séries ou animes.
            Nossa equipe de aquisição entrará em ação imediatamente.
          </motion.p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Form Side */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-5 space-y-8"
          >
            <div className="glass-card bg-zinc-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />

              <div className="relative space-y-8">
                {/* Mode Toggles */}
                <div className="flex p-1.5 bg-black/40 rounded-2xl border border-white/5">
                  <button
                    onClick={() => setMode("tmdb")}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                      mode === "tmdb" ? "bg-primary text-white shadow-lg" : "text-zinc-600 hover:text-white"
                    )}
                  >
                    TMDB Discovery
                  </button>
                  <button
                    onClick={() => setMode("manual")}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                      mode === "manual" ? "bg-primary text-white shadow-lg" : "text-zinc-600 hover:text-white"
                    )}
                  >
                    Manual Upload
                  </button>
                </div>

                {/* Notifications */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
                      <AlertCircle className="text-red-400" size={18} />
                      <p className="text-red-400 text-xs font-bold leading-tight">{error}</p>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                      <CheckCircle2 className="text-emerald-400" size={18} />
                      <p className="text-emerald-400 text-xs font-bold leading-tight">{success}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Content */}
                <div className="space-y-6">
                  {mode === "tmdb" ? (
                    <div className="space-y-4">
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-primary transition-colors" size={20} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearchTmdb()}
                          placeholder="Ex: Interstellar, Breaking Bad..."
                          className="w-full bg-black/40 border border-white/5 rounded-2xl py-5 pl-12 pr-32 text-white font-black placeholder:text-zinc-800 focus:outline-none focus:border-primary/50 transition-all outline-none"
                        />
                        <button
                          onClick={() => handleSearchTmdb()}
                          disabled={searchLoading}
                          className="absolute right-2 top-2 bottom-2 px-6 bg-primary hover:bg-red-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                          {searchLoading ? <Loader2 className="animate-spin" size={14} /> : (
                            <>
                              Buscar
                              <Search size={14} />
                            </>
                          )}
                        </button>
                      </div>

                      {/* TMDB Results List */}
                      <AnimatePresence>
                        {searchResults.length > 0 && !selectedResult && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {searchResults.map((item) => (
                              <button
                                key={`${item.type}-${item.tmdbId}`}
                                onClick={() => {
                                  setSelectedResult(item);
                                  setTitleInput(item.name);
                                  setType(item.type || "MOVIE");
                                }}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-3 flex gap-4 transition-all text-left"
                              >
                                <img src={item.posterUrl || ""} className="w-12 h-18 rounded-lg object-cover bg-zinc-800" />
                                <div className="space-y-1 py-1">
                                  <p className="font-black text-sm text-white line-clamp-1">{item.name}</p>
                                  <p className="text-[10px] uppercase font-black tracking-widest text-zinc-600">
                                    {item.type === "MOVIE" ? "Filme" : "Série"} • {item.releaseDate?.split("-")[0]}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Selected Result Display */}
                      {selectedResult && (
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-4 items-center animate-in fade-in slide-in-from-top-4 duration-500">
                          <img src={selectedResult.posterUrl || ""} className="w-16 h-24 rounded-xl object-cover shadow-2xl" />
                          <div className="flex-1 space-y-1">
                            <h3 className="font-black text-lg">{selectedResult.name}</h3>
                            <div className="flex gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[9px] font-black uppercase tracking-widest">{selectedResult.type}</span>
                              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[9px] font-black uppercase tracking-widest">{selectedResult.releaseDate?.split("-")[0]}</span>
                            </div>
                            <button onClick={() => setSelectedResult(null)} className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors">Trocar Título</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 ml-4">Nome do Título</label>
                      <input
                        type="text"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        placeholder="Nome difícil de achar..."
                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-5 px-6 font-black text-white outline-none focus:border-primary/50 transition-all"
                      />
                    </div>
                  )}

                  {/* Shared Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 text-primary">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 ml-4">Tipo</label>
                      <div className="relative">
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-5 font-black text-sm appearance-none outline-none focus:border-primary/50 transition-all"
                        >
                          <option value="MOVIE">Filme</option>
                          <option value="SERIES">Série</option>
                          <option value="ANIME">Anime</option>
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-zinc-600 pointer-events-none" size={16} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 ml-4">Qualidade</label>
                      <div className="relative">
                        <select
                          value={quality}
                          onChange={(e) => setQuality(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-5 font-black text-sm appearance-none outline-none focus:border-primary/50 transition-all"
                        >
                          <option value="1080p">1080p Full HD</option>
                          <option value="4K">4K Ultra HD</option>
                          <option value="720p">720p HD</option>
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-zinc-600 pointer-events-none" size={16} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 ml-4">Preferência de Áudio</label>
                    <div className="flex flex-wrap gap-2">
                      {["dublado", "legendado", "original"].map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => toggleLanguage(lang)}
                          className={cn(
                            "px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
                            languages.includes(lang)
                              ? "bg-primary text-white scale-105"
                              : "bg-black/40 text-zinc-600 border border-white/5 hover:border-white/20"
                          )}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 ml-4">Nota Adicional</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="Alguma versão específica? Algum detalhe especial?"
                      className="w-full bg-black/40 border border-white/5 rounded-[24px] py-4 px-6 text-sm outline-none focus:border-primary/50 transition-all resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full h-16 bg-primary hover:bg-red-700 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-sm text-white transition-all shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-95 disabled:bg-zinc-800 disabled:cursor-not-allowed"
                  >
                    {submitting ? <Loader2 className="animate-spin" /> : (
                      <>
                        Enviar Solicitação
                        <Send size={18} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* List Side */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-4">
                <History className="text-primary" />
                Feed de Pedidos
              </h2>
              <div className="px-4 py-2 rounded-full border border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {requests.length} Solicitações
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="popLayout">
                {loadingRequests ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 bg-zinc-900 animate-pulse rounded-[32px] border border-white/5" />
                  ))
                ) : requests.map((item, idx) => {
                  const status = getStatusLabel(item.status);
                  const Icon = status.icon;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group glass-card bg-zinc-900/20 hover:bg-zinc-900/60 border border-white/5 hover:border-white/10 rounded-[32px] p-6 transition-all duration-500 hover:-translate-y-1 relative overflow-hidden"
                    >
                      {/* Subscriptions count float */}
                      <div className="absolute top-4 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/5 text-zinc-500">
                        <Users size={14} />
                        <span className="text-[11px] font-black">{item.followersCount || 1}</span>
                      </div>

                      <div className="flex gap-6 items-start">
                        {/* Status Icon Orb */}
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-500",
                          status.color === "emerald" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]" :
                            status.color === "blue" ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                              status.color === "purple" ? "bg-purple-500/10 border-purple-500/20 text-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]" :
                                status.color === "red" ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                  "bg-zinc-800 border-white/5 text-zinc-400"
                        )}>
                          <Icon size={24} />
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="space-y-1">
                            <h3 className="text-xl font-black text-white group-hover:text-primary transition-colors">{item.title}</h3>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{item.type}</span>
                              <span className="text-[10px] font-black uppercase text-zinc-700 tracking-widest">•</span>
                              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{item.desiredQuality}</span>
                              <span className="text-[10px] font-black uppercase text-zinc-700 tracking-widest">•</span>
                              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{status.label}</span>
                            </div>
                          </div>

                          {/* Progress bar visual for production/review */}
                          {item.status !== "COMPLETED" && item.status !== "REJECTED" && (
                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: item.status === "PENDING" ? "20%" : item.status === "UNDER_REVIEW" ? "50%" : "85%" }}
                                className={cn(
                                  "h-full rounded-full transition-all duration-1000",
                                  item.status === "PENDING" ? "bg-zinc-700" : item.status === "UNDER_REVIEW" ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                )}
                              />
                            </div>
                          )}

                          {item.note && (
                            <div className="flex gap-2 items-start text-xs text-zinc-600 bg-black/20 p-3 rounded-2xl italic border border-white/5">
                              <MessageSquare size={14} className="shrink-0 mt-0.5" />
                              <p>"{item.note}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
                }
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
