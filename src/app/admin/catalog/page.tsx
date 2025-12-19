"use client";

import Link from "next/link";
import { useState, useEffect, FormEvent, useMemo } from "react";
import BulkActions from "@/components/admin/BulkActions";
import CatalogGridView from "@/components/admin/CatalogGridView";
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  MoreVertical,
  Edit2,
  Trash2,
  Play,
  Tv,
  Settings2,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Film,
  Sparkles,
  MoreHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Badge from "@/components/admin/Badge";

type TitleType = "MOVIE" | "SERIES" | "ANIME" | "OTHER";

interface Title {
  id: string;
  tmdbId: number | null;
  type: TitleType;
  slug: string;
  name: string;
  originalName: string | null;
  overview: string | null;
  tagline: string | null;
  releaseDate: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  hlsPath: string | null;
}

interface TmdbResult {
  tmdbId: number;
  type: TitleType;
  name: string;
  originalName: string | null;
  overview: string;
  releaseDate: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCatalogPage() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [transcodingId, setTranscodingId] = useState<string | null>(null);
  const [transcodingProgress, setTranscodingProgress] = useState<number | null>(null);
  const [transcodingStatus, setTranscodingStatus] = useState<string | null>(null);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratingTagline, setAiGeneratingTagline] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{
    overview?: string;
    tagline?: string | null;
    tags?: string[];
    model?: string;
    task?: string;
  } | null>(null);

  const [showTitleModal, setShowTitleModal] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [showTranscodeOptions, setShowTranscodeOptions] = useState(false);

  const [transcodeCrf, setTranscodeCrf] = useState<number>(20);
  const [deleteSourceAfterTranscode, setDeleteSourceAfterTranscode] =
    useState<boolean>(true);

  const [subtitleLoadingId, setSubtitleLoadingId] = useState<string | null>(null);

  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshingTmdb, setRefreshingTmdb] = useState(false);
  const [hlsStatus, setHlsStatus] = useState<Record<string, string>>({});
  const [pendingEpisodesSummary, setPendingEpisodesSummary] = useState<
    Record<string, { total: number; pending: number }>
  >({});

  // BUSCA E FILTROS
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<TitleType | "ALL">("ALL");
  const [filterHlsStatus, setFilterHlsStatus] = useState<"ALL" | "WITH_HLS" | "WITHOUT_HLS">("ALL");

  // PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // SELEÇÃO MÚLTIPLA
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // VIEW MODE (LIST ou GRID)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [form, setForm] = useState({
    tmdbId: "",
    type: "MOVIE" as TitleType,
    name: "",
    slug: "",
    originalName: "",
    overview: "",
    tagline: "",
    releaseDate: "",
    posterUrl: "",
    backdropUrl: "",
    hlsPath: "",
  });

  async function loadTitles() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/titles?limit=1000");
      if (!res.ok) {
        throw new Error("Erro ao carregar títulos");
      }
      const json = await res.json();
      const list: Title[] = Array.isArray(json)
        ? (json as Title[])
        : Array.isArray(json.data)
          ? (json.data as Title[])
          : [];

      setTitles(list);

      const titleIds = list.map((t) => t.id);

      if (titleIds.length === 0) {
        setHlsStatus({});
        setPendingEpisodesSummary({});
        return;
      }

      try {
        const resStatus = await fetch("/api/admin/titles/hls-status-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titleIds }),
        });

        if (resStatus.ok) {
          const jsonStatus = await resStatus.json();
          setHlsStatus(jsonStatus.statusMap || {});
        } else {
          setHlsStatus({});
        }
      } catch {
        setHlsStatus({});
      }

      try {
        const resPending = await fetch("/api/admin/titles/pending-episodes-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titleIds }),
        });

        if (resPending.ok) {
          const jsonPending = await resPending.json();
          setPendingEpisodesSummary(jsonPending.summary || {});
        } else {
          setPendingEpisodesSummary({});
        }
      } catch {
        setPendingEpisodesSummary({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar títulos");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshAllFromTmdb() {
    if (
      !confirm(
        "Atualizar metadados TMDb de todos os filmes e séries? Isso pode levar alguns minutos.",
      )
    ) {
      return;
    }

    setRefreshingTmdb(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch("/api/admin/titles/refresh-tmdb", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao atualizar títulos a partir do TMDB");
      }
      setInfo(
        `Atualização TMDb concluída: ${data.updated} de ${data.total} títulos atualizados.`,
      );
      await loadTitles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar títulos a partir do TMDB");
    } finally {
      setRefreshingTmdb(false);
    }
  }

  async function handleFetchSubtitle(id: string, language: string) {
    setError(null);
    setInfo(null);
    setSubtitleLoadingId(id);
    try {
      const res = await fetch(`/api/subtitles/fetch/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao baixar legenda automática");
      }

      setInfo("Legenda baixada e salva no Wasabi com sucesso.");
      await loadTitles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao baixar legenda automática");
    } finally {
      setSubtitleLoadingId(null);
    }
  }

  async function handleTranscode(id: string, type: TitleType) {
    setError(null);
    setInfo(null);
    setTranscodingId(id);
    setTranscodingProgress(null);
    setTranscodingStatus(null);
    try {
      if (type === "SERIES" || type === "ANIME") {
        const res = await fetch(`/api/admin/titles/${id}/transcode-episodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crf: transcodeCrf,
            deleteSource: deleteSourceAfterTranscode,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Erro ao enfileirar HLS para episódios.");
        }

        const queued = Array.isArray(data?.queued) ? data.queued.length : 0;
        const skipped = Array.isArray(data?.skipped) ? data.skipped.length : 0;
        const errors = Array.isArray(data?.errors) ? data.errors.length : 0;

        const parts: string[] = [];
        parts.push(`Enfileirados ${queued} episódio(s) para HLS.`);
        if (skipped > 0) parts.push(`${skipped} ignorado(s) sem arquivo de origem.`);
        if (errors > 0)
          parts.push(`${errors} com erro ao criar job (veja logs do transcoder).`);

        setInfo(parts.join(" "));
        setTranscodingId(null);
        setTranscodingProgress(null);
        setTranscodingStatus(null);
        await loadTitles();
      } else {
        const res = await fetch(`/api/transcode/hls/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crf: transcodeCrf,
            deleteSource: deleteSourceAfterTranscode,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Erro ao gerar HLS para este título");
        }
        const jobId: string | undefined = data?.jobId;
        if (!jobId) {
          throw new Error("Serviço de transcodificação não retornou jobId.");
        }

        const poll = async () => {
          try {
            const statusRes = await fetch(
              `/api/transcode/hls/${id}?job_id=${encodeURIComponent(jobId)}`,
            );
            const statusData = await statusRes.json();

            if (!statusRes.ok) {
              throw new Error(statusData?.error ?? "Erro ao consultar status do job");
            }

            const status: string = statusData.status ?? "";
            const progress: number =
              typeof statusData.progress === "number" ? statusData.progress : 0;
            const message: string | null = statusData.message ?? null;

            setTranscodingStatus(status);
            setTranscodingProgress(progress);

            if (status === "completed") {
              await loadTitles();
              setInfo(
                "Transcodificação HLS concluída. Arquivos gerados no prefixo do título.",
              );
              setTranscodingId(null);
              setTranscodingProgress(null);
              setTranscodingStatus(null);
              return false;
            }

            if (status === "error") {
              setError(
                message || "Job de transcodificação falhou. Verifique os logs do transcoder.",
              );
              setTranscodingId(null);
              setTranscodingProgress(null);
              setTranscodingStatus(null);
              return false;
            }

            return true;
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao consultar status do job");
            setTranscodingId(null);
            setTranscodingProgress(null);
            setTranscodingStatus(null);
            return false;
          }
        };

        const keepPolling = await poll();
        if (keepPolling) {
          const interval = setInterval(async () => {
            const cont = await poll();
            if (!cont) {
              clearInterval(interval);
            }
          }, 5000);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar transcodificação HLS");
    } finally {
      // finalizado no polling
    }
  }

  useEffect(() => {
    loadTitles();
  }, []);

  function resetForm() {
    setEditingId(null);
    setAiSuggestion(null);
    setAiError(null);
    setForm({
      tmdbId: "",
      type: "MOVIE",
      name: "",
      slug: "",
      originalName: "",
      overview: "",
      tagline: "",
      releaseDate: "",
      posterUrl: "",
      backdropUrl: "",
      hlsPath: "",
    });
    setTmdbResults([]);
  }

  function applyTmdbResult(result: TmdbResult) {
    setForm((prev) => ({
      ...prev,
      tmdbId: String(result.tmdbId),
      type: result.type,
      name: result.name,
      slug: prev.slug || slugify(result.name),
      originalName: result.originalName ?? "",
      overview: result.overview ?? "",
      releaseDate: result.releaseDate ?? "",
      posterUrl: result.posterUrl ?? "",
      backdropUrl: result.backdropUrl ?? "",
    }));
  }

  async function handleTmdbSearch(e: FormEvent) {
    e.preventDefault();
    if (!tmdbQuery.trim()) return;

    setTmdbLoading(true);
    setError(null);
    try {
      const url = new URL("/api/tmdb/search", window.location.origin);
      url.searchParams.set("q", tmdbQuery.trim());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao consultar TMDb");
      }
      setTmdbResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar TMDb");
    } finally {
      setTmdbLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      let payload: Record<string, unknown>;

      if (editingId) {
        payload = {
          tmdbId: form.tmdbId ? Number(form.tmdbId) : null,
          type: form.type,
          slug: form.slug || slugify(form.name),
          name: form.name,
          originalName: form.originalName || null,
          overview: form.overview || null,
          tagline: form.tagline || null,
          releaseDate: form.releaseDate || null,
          posterUrl: form.posterUrl || null,
          backdropUrl: form.backdropUrl || null,
          hlsPath: form.hlsPath || null,
        };
      } else {
        if (!form.tmdbId || !form.type) {
          throw new Error("Selecione um título do TMDB antes de adicionar.");
        }
        payload = {
          tmdbId: Number(form.tmdbId),
          type: form.type,
        };
      }

      const url = editingId ? `/api/titles/${editingId}` : "/api/titles";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao salvar título");
      }

      setInfo(editingId ? "Título atualizado com sucesso!" : "Título adicionado com todos os metadados do TMDB!");
      await loadTitles();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar título");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(title: Title) {
    setEditingId(title.id);
    setAiSuggestion(null);
    setAiError(null);
    setForm({
      tmdbId: title.tmdbId ? String(title.tmdbId) : "",
      type: title.type,
      name: title.name,
      slug: title.slug,
      originalName: title.originalName ?? "",
      overview: title.overview ?? "",
      tagline: title.tagline ?? "",
      releaseDate: title.releaseDate ? title.releaseDate.slice(0, 10) : "",
      posterUrl: title.posterUrl ?? "",
      backdropUrl: title.backdropUrl ?? "",
      hlsPath: title.hlsPath ?? "",
    });
  }

  async function handleGenerateAi() {
    if (!form.name?.trim()) {
      setAiError("Informe o nome do título antes de gerar a sinopse.");
      return;
    }

    setAiGenerating(true);
    setAiError(null);

    try {
      const res = await fetch("/api/admin/ai/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          originalName: form.originalName || null,
          type: form.type,
          releaseDate: form.releaseDate || null,
          tmdbId: form.tmdbId ? Number(form.tmdbId) : null,
          overview: form.overview || null,
          language: "pt-BR",
          task: "catalog",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const baseMessage = data?.error || data?.upstreamError || "Erro ao gerar conteúdo com IA";
        const modelTried = data?.modelTried ? ` (model: ${data.modelTried})` : "";
        throw new Error(`${baseMessage}${modelTried}`);
      }

      setAiSuggestion(data);
      if (data?.overview && typeof data.overview === "string") {
        setForm((prev) => ({ ...prev, overview: data.overview }));
      }
      if (data?.tagline && typeof data.tagline === "string") {
        setForm((prev) => ({ ...prev, tagline: data.tagline }));
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erro ao gerar conteúdo com IA");
      setAiSuggestion(null);
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleGenerateAiTagline() {
    if (!form.name?.trim()) {
      setAiError("Informe o nome do título antes de gerar a tagline.");
      return;
    }

    setAiGeneratingTagline(true);
    setAiError(null);

    try {
      const res = await fetch("/api/admin/ai/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          originalName: form.originalName || null,
          type: form.type,
          releaseDate: form.releaseDate || null,
          tmdbId: form.tmdbId ? Number(form.tmdbId) : null,
          overview: form.overview || null,
          language: "pt-BR",
          task: "tagline",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const baseMessage = data?.error || data?.upstreamError || "Erro ao gerar conteúdo com IA";
        const modelTried = data?.modelTried ? ` (model: ${data.modelTried})` : "";
        throw new Error(`${baseMessage}${modelTried}`);
      }

      setAiSuggestion(data);
      if (data?.tagline && typeof data.tagline === "string") {
        setForm((prev) => ({ ...prev, tagline: data.tagline }));
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erro ao gerar conteúdo com IA");
      setAiSuggestion(null);
    } finally {
      setAiGeneratingTagline(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este título?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/titles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao excluir título");
      }
      await loadTitles();
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir título");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
              <Film size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">Catálogo</h2>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                Gestão de Inteligência de Mídia
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRefreshAllFromTmdb}
            disabled={refreshingTmdb}
            className="h-12 px-6 rounded-2xl border border-white/5 bg-white/5 text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 flex items-center gap-3"
          >
            {refreshingTmdb ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            {refreshingTmdb ? "Sincronizando..." : "Sincronizar Cloud"}
          </button>
          <button
            type="button"
            onClick={() => { resetForm(); setShowTitleModal(true); }}
            className="h-12 px-8 rounded-2xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-primary/20 hover:shadow-primary/40 flex items-center gap-3 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            Novo Título
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {info}
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Títulos cadastrados</h3>
          {loading && <span className="text-[10px] text-zinc-500">Carregando...</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Buscar por título, ID ou slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-14 pr-6 text-sm font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>

          <div className="lg:col-span-2 flex bg-white/5 p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex-1 flex items-center justify-center h-10 rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === "list" ? "bg-primary text-white shadow-lg" : "text-zinc-500 hover:text-white"
              )}
            >
              <List size={14} />
              Lista
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex-1 flex items-center justify-center h-10 rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === "grid" ? "bg-primary text-white shadow-lg" : "text-zinc-500 hover:text-white"
              )}
            >
              <LayoutGrid size={14} />
              Grid
            </button>
          </div>

          <div className="lg:col-span-4 flex gap-3">
            <div className="flex-1 relative group">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as TitleType | "ALL")}
                className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 appearance-none focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
              >
                <option value="ALL">Categorias</option>
                <option value="MOVIE">Filmes</option>
                <option value="SERIES">Séries</option>
                <option value="ANIME">Animes</option>
              </select>
            </div>
            <div className="flex-1 relative group">
              <Settings2 className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <select
                value={filterHlsStatus}
                onChange={(e) => setFilterHlsStatus(e.target.value as "ALL" | "WITH_HLS" | "WITHOUT_HLS")}
                className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 appearance-none focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
              >
                <option value="ALL">Status HLS</option>
                <option value="WITH_HLS">Pronto</option>
                <option value="WITHOUT_HLS">Pendente</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-2">
            <button
              onClick={() => { setSearchQuery(""); setFilterType("ALL"); setFilterHlsStatus("ALL"); }}
              disabled={!searchQuery && filterType === "ALL" && filterHlsStatus === "ALL"}
              className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-0 disabled:pointer-events-none"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        <div className="mb-2">
          <button
            type="button"
            onClick={() => setShowTranscodeOptions((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-200 hover:bg-zinc-800"
          >
            <div className="flex flex-col text-left">
              <span className="font-semibold text-zinc-100">Opções avançadas de HLS</span>
              <span className="text-[10px] text-zinc-400">
                CRF atual: {transcodeCrf} · Apagar origem: {deleteSourceAfterTranscode ? "sim" : "não"}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">{showTranscodeOptions ? "▴" : "▾"}</span>
          </button>
          {showTranscodeOptions && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-300">
              <label className="flex items-center gap-1">
                <span>Qualidade (CRF)</span>
                <select
                  value={transcodeCrf}
                  onChange={(e) => setTranscodeCrf(Number(e.target.value) || 20)}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
                >
                  <option value={18}>Alta (CRF 18)</option>
                  <option value={20}>Padrão (CRF 20)</option>
                  <option value={23}>Econômica (CRF 23)</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={deleteSourceAfterTranscode}
                  onChange={(e) => setDeleteSourceAfterTranscode(e.target.checked)}
                  className="h-3 w-3 accent-emerald-500"
                />
                <span>Apagar arquivo bruto após HLS</span>
              </label>
            </div>
          )}
        </div>

        {(!titles || titles.length === 0) && !loading ? (
          <p className="text-xs text-zinc-500">
            Nenhum título cadastrado ainda. Use o botão "+ Novo título (TMDb)" para criar o primeiro.
          </p>
        ) : (
          <>
            {(() => {
              const safeList = Array.isArray(titles) ? titles : [];
              const filtered = safeList.filter((t) => {
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  const matchName = t.name.toLowerCase().includes(query);
                  const matchOriginal = t.originalName?.toLowerCase().includes(query);
                  const matchSlug = t.slug.toLowerCase().includes(query);
                  if (!matchName && !matchOriginal && !matchSlug) return false;
                }
                if (filterType !== "ALL" && t.type !== filterType) return false;
                if (filterHlsStatus === "WITH_HLS" && hlsStatus[t.id] !== "hls_ready") return false;
                if (filterHlsStatus === "WITHOUT_HLS" && hlsStatus[t.id] === "hls_ready") return false;
                return true;
              });

              const totalPages = Math.ceil(filtered.length / itemsPerPage);
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedTitles = filtered.slice(startIndex, endIndex);

              return (
                <>
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>{filtered.length} de {safeList.length} título(s)</span>
                    {totalPages > 1 && <span>Página {currentPage} de {totalPages}</span>}
                  </div>

                  {viewMode === "grid" ? (
                    <CatalogGridView
                      titles={paginatedTitles as any}
                      hlsStatus={hlsStatus}
                      pendingSummary={pendingEpisodesSummary}
                      selectedIds={selectedIds}
                      onToggleSelect={(id) => {
                        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id));
                        else setSelectedIds([...selectedIds, id]);
                      }}
                      onEdit={(title: any) => startEdit(title)}
                      onDelete={(id) => handleDelete(id)}
                      onTranscode={(id, type) => handleTranscode(id, type as TitleType)}
                    />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/50 backdrop-blur-3xl shadow-2xl">
                      <table className="w-full border-collapse text-left">
                        <thead className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                          <tr>
                            <th className="px-6 py-5 w-12 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.length === paginatedTitles.length && paginatedTitles.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedIds(paginatedTitles.map((t: any) => t.id));
                                  else setSelectedIds([]);
                                }}
                                className="w-4 h-4 rounded border-white/10 bg-black/40 text-primary focus:ring-primary/50"
                              />
                            </th>
                            <th className="px-6 py-5 whitespace-nowrap">Pôster</th>
                            <th className="px-6 py-5 w-full">Informações</th>
                            <th className="px-6 py-5 whitespace-nowrap text-center">Tipo</th>
                            <th className="px-6 py-5 whitespace-nowrap text-center">Status HLS</th>
                            <th className="px-6 py-5 whitespace-nowrap text-right pr-12">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                          {paginatedTitles.length === 0 ? (
                            <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-zinc-500">Nenhum título encontrado.</td></tr>
                          ) : (
                            paginatedTitles.map((t) => (
                              <tr key={t.id} className="align-top text-[11px]">
                                <td className="px-6 py-5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(t.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedIds([...selectedIds, t.id]);
                                      else setSelectedIds(selectedIds.filter(id => id !== t.id));
                                    }}
                                    className="w-4 h-4 rounded border-white/10 bg-black/40 text-primary focus:ring-primary/50"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  {t.posterUrl ? (
                                    <img src={t.posterUrl} alt={t.name} className="h-16 w-11 rounded object-cover shadow-md" loading="lazy" />
                                  ) : (
                                    <div className="flex h-16 w-11 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">N/A</div>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-bold text-white text-sm tracking-tight">{t.name}</div>
                                  <div className="text-[10px] font-black uppercase text-zinc-600 mt-1">{t.releaseDate ? t.releaseDate.slice(0, 10) : "S/ DATA"}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-black uppercase text-zinc-400">{t.type}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {hlsStatus[t.id] === "hls_ready" ? (
                                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">READY</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">PENDING</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right pr-12">
                                  <div className="flex items-center justify-end gap-2">
                                    {(t.type === "SERIES" || t.type === "ANIME") && (
                                      <Link href={`/admin/catalog/${t.id}`} className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-[9px] font-black uppercase text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Sessões</Link>
                                    )}
                                    <button onClick={() => { startEdit(t); setShowTitleModal(true); }} className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-[9px] font-black uppercase text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Editar</button>
                                    <div className="relative">
                                      <button onClick={() => setOpenActionsId(prev => prev === t.id ? null : t.id)} className={cn("p-2 rounded-xl border transition-all", openActionsId === t.id ? "bg-white text-black border-white" : "bg-white/5 border-white/5 text-zinc-400 hover:text-white")}><MoreHorizontal size={14} /></button>
                                      {openActionsId === t.id && (
                                        <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-white/10 bg-zinc-950/95 backdrop-blur-2xl p-2 shadow-2xl">
                                          <button onClick={() => { setOpenActionsId(null); handleFetchSubtitle(t.id, "pt-BR"); }} disabled={subtitleLoadingId === t.id} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:bg-white/5 hover:text-white transition-all"><span>📥</span>Legendas</button>
                                          <button onClick={() => { setOpenActionsId(null); handleTranscode(t.id, t.type); }} disabled={transcodingId === t.id} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:bg-white/5 hover:text-white transition-all"><span>🎬</span>Gerar HLS</button>
                                          <div className="h-px bg-white/5 my-1" />
                                          <button onClick={() => { setOpenActionsId(null); handleDelete(t.id); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-all"><span>🗑️</span>Excluir</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8 bg-white/5 backdrop-blur-3xl border border-white/5 p-4 rounded-2xl w-fit mx-auto shadow-2xl">
                      <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-zinc-500 transition-all hover:border-white/20 hover:text-white disabled:opacity-30"><ChevronLeft size={18} /></button>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum = totalPages <= 5 ? i + 1 : (currentPage <= 3 ? i + 1 : (currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i));
                          return (
                            <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-[10px] font-black uppercase transition-all", currentPage === pageNum ? "bg-white text-black shadow-lg" : "border border-white/5 bg-white/5 text-zinc-500 hover:text-white")}>{pageNum}</button>
                          );
                        })}
                      </div>
                      <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-zinc-500 transition-all hover:border-white/20 hover:text-white disabled:opacity-30"><ChevronRight size={18} /></button>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        <BulkActions selectedIds={selectedIds} onClearSelection={() => setSelectedIds([])} onRefresh={loadTitles} />
      </div>

      {showTitleModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-8 text-xs shadow-2xl custom-scrollbar">
            <div className="mb-8 flex items-start justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{editingId ? "Ajustar Título" : "Injetar no Catálogo"}</h3>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sincronização TMDb & IA</p>
              </div>
              <button onClick={() => { setShowTitleModal(false); resetForm(); }} className="p-3 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/10"><X size={20} /></button>
            </div>

            {!editingId && (
              <div className="mb-8 space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5">
                <form onSubmit={handleTmdbSearch} className="flex gap-3">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-primary transition-colors" size={18} />
                    <input type="text" placeholder="Nome do título (Filme, Série ou Anime)..." value={tmdbQuery} onChange={(e) => setTmdbQuery(e.target.value)} className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl pl-14 pr-6 text-sm text-white focus:outline-none focus:border-primary/50 transition-all" />
                  </div>
                  <button type="submit" disabled={tmdbLoading || !tmdbQuery.trim()} className="h-14 px-8 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-zinc-200 transition-all disabled:opacity-50">{tmdbLoading ? "Buscando..." : "Explorar"}</button>
                </form>
                {tmdbResults.length > 0 && (
                  <div className="grid grid-cols-1 gap-2">
                    {tmdbResults.map((r) => (
                      <button key={`${r.type}-${r.tmdbId}`} onClick={() => applyTmdbResult(r)} className="flex items-center gap-4 p-3 rounded-2xl bg-black/40 border border-white/5 hover:border-primary/30 transition-all text-left group">
                        {r.posterUrl && <img src={r.posterUrl} alt={r.name} className="h-16 w-11 rounded-lg object-cover shadow-2xl" />}
                        <div className="flex-1">
                          <div className="font-bold text-white group-hover:text-primary transition-colors">{r.name}</div>
                          <div className="text-[9px] font-black uppercase text-zinc-600 mt-1">{r.type} • {r.releaseDate?.slice(0, 4) || "N/A"}</div>
                        </div>
                        <Plus size={20} className="text-zinc-700" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">TMDb ID</label>
                  <input type="number" value={form.tmdbId} onChange={(e) => setForm({ ...form, tmdbId: e.target.value })} className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl px-6 text-sm text-white focus:outline-none focus:border-primary/50 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Categoria</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TitleType })} className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl px-6 text-xs font-black uppercase tracking-widest text-white appearance-none focus:outline-none focus:border-primary/50 cursor-pointer">
                    <option value="MOVIE">Filme</option><option value="SERIES">Série</option><option value="ANIME">Anime</option><option value="OTHER">Outro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nome de Exibição</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} required className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl px-6 text-sm text-white focus:outline-none focus:border-primary/50 transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Slug URL</label>
                  <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl px-6 text-sm text-white focus:outline-none focus:border-primary/50 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Lançamento</label>
                  <input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl px-6 text-xs text-white focus:outline-none focus:border-primary/50 transition-all" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sinopse Narrativa</label>
                  <button type="button" onClick={handleGenerateAi} disabled={aiGenerating || !form.name.trim()} className="text-[9px] font-black uppercase text-primary hover:text-red-400 transition-colors disabled:opacity-50 flex items-center gap-1.5"><Sparkles size={12} />{aiGenerating ? "Redigindo..." : "Refinar com IA"}</button>
                </div>
                <textarea rows={4} value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} className="w-full bg-white/5 border border-white/5 rounded-2xl p-6 text-xs leading-relaxed text-zinc-300 focus:outline-none focus:border-primary/50 transition-all custom-scrollbar" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Poster URL</label>
                  <input type="text" value={form.posterUrl} onChange={(e) => setForm({ ...form, posterUrl: e.target.value })} className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl px-6 text-[10px] text-zinc-400 focus:outline-none focus:border-primary/50 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Wasabi HLS Code</label>
                  <input type="text" placeholder="id-wasabi/" value={form.hlsPath} onChange={(e) => setForm({ ...form, hlsPath: e.target.value })} className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl px-6 text-[10px] text-zinc-400 focus:outline-none focus:border-primary/50 transition-all" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 mt-6 border-t border-white/5">
                <button type="button" onClick={() => { setShowTitleModal(false); resetForm(); }} className="h-14 px-8 rounded-2xl text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">Cancelar</button>
                <button type="submit" disabled={saving} className="h-14 px-12 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-zinc-200 transition-all shadow-2xl active:scale-[0.98] disabled:opacity-50">{saving ? "Processando..." : (editingId ? "Salvar Alterações" : "Injetar Título")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
