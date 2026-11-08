"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { uploadMultipartFile } from "@/lib/upload/multipart-client";

// ============================================================================
// TYPES
// ============================================================================

type GroupKind = "MOVIE" | "SERIES";

interface Candidate {
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  posterUrl: string | null;
  overview: string;
  existingTitleId?: string | null;
}

interface PickedFile {
  id: string;
  file: File;
  path: string;
}

interface GroupFile {
  id: string; // id do PickedFile
  name: string;
  season: number | null;
  episode: number | null;
  confidence: number;
}

interface Group {
  key: string;
  kind: GroupKind;
  title: string;
  year: number | null;
  candidates: Candidate[];
  selectedTmdbId: number | null;
  included: boolean;
  files: GroupFile[];
  searchQuery: string;
  searching: boolean;
  searchError: string | null;
}

interface IdentifyResponse {
  groups: Array<{
    key: string;
    kind: GroupKind;
    title: string;
    year: number | null;
    candidates: Candidate[];
    selectedTmdbId: number | null;
    existingTitleId: string | null;
    files: Array<{
      index: number;
      name: string;
      season: number | null;
      episode: number | null;
      confidence: number;
    }>;
  }>;
  unknown: Array<{ index: number; name: string }>;
  warning?: string;
}

type FileStatus = "pending" | "uploading" | "completed" | "error" | "skipped";

interface FileState {
  status: FileStatus;
  progress: number;
  error?: string;
  speed?: number;
  eta?: number;
}

type GroupRunStatus = "pending" | "running" | "done" | "error";

interface GroupRun {
  status: GroupRunStatus;
  message?: string;
  transcode?: string;
  transcodeError?: string;
}

interface TitleInfo {
  id: string;
  name: string;
  slug: string;
  type: string;
}

const VIDEO_EXTENSIONS = ["mp4", "mkv", "avi", "mov", "m4v", "webm", "ts"];
const MAX_IDENTIFY = 300;

// ============================================================================
// HELPERS
// ============================================================================

function extensionOf(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function pad2(n: number | null): string {
  return n === null ? "--" : n.toString().padStart(2, "0");
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function entryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry: FileSystemEntry, out: Array<{ file: File; path: string }>) {
  if (entry.isFile) {
    try {
      const file = await entryToFile(entry as FileSystemFileEntry);
      out.push({ file, path: entry.fullPath.replace(/^\/+/, "") });
    } catch {
      // arquivo ilegível: ignora
    }
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    while (true) {
      const batch = await readEntries(reader).catch(() => [] as FileSystemEntry[]);
      if (batch.length === 0) break;
      for (const child of batch) {
        await walkEntry(child, out);
      }
    }
  }
}

async function collectFromDataTransfer(dt: DataTransfer): Promise<Array<{ file: File; path: string }>> {
  const out: Array<{ file: File; path: string }> = [];
  const items = Array.from(dt.items ?? []);
  const entries = items
    .map((item) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e !== null);

  if (entries.length === 0) {
    for (const file of Array.from(dt.files)) out.push({ file, path: file.name });
    return out;
  }

  for (const entry of entries) {
    await walkEntry(entry, out);
  }
  return out;
}

function candidateLabel(c: Candidate): string {
  const year = c.year ? ` (${c.year})` : "";
  const existing = c.existingTitleId ? " - já no catálogo" : "";
  return `${c.name}${year}${existing}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UploadSmartPage() {
  // Seleção de arquivos
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Identificação
  const [identifying, setIdentifying] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [unknownFiles, setUnknownFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [warning, setWarning] = useState<string | null>(null);

  // Opções
  const [autoTranscode, setAutoTranscode] = useState(true);
  const [deleteSource, setDeleteSource] = useState(true);
  const [crf, setCrf] = useState(20);

  // Envio
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [fileStates, setFileStates] = useState<Record<string, FileState>>({});
  const [groupRuns, setGroupRuns] = useState<Record<string, GroupRun>>({});

  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const completedIds = useRef<Set<string>>(new Set());
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "true");
      folderInputRef.current.setAttribute("directory", "true");
    }
  }, []);

  // Avisar antes de fechar a aba durante o envio
  useEffect(() => {
    if (!running) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  // Cancelar upload em andamento ao sair da página
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  // ==========================================================================
  // SELEÇÃO DE ARQUIVOS
  // ==========================================================================

  function addEntries(entries: Array<{ file: File; path: string }>) {
    if (running || groups) return;

    const isVideo = (file: File) => VIDEO_EXTENSIONS.includes(extensionOf(file.name)) && file.size > 0;

    setPicked((prev) => {
      const known = new Set(prev.map((p) => `${p.path}|${p.file.size}|${p.file.lastModified}`));
      const valid: PickedFile[] = [];
      for (const { file, path } of entries) {
        if (!isVideo(file)) continue;
        const sig = `${path}|${file.size}|${file.lastModified}`;
        if (known.has(sig)) continue;
        known.add(sig);
        valid.push({ id: newId(), file, path });
      }
      return valid.length > 0 ? [...prev, ...valid] : prev;
    });

    const ignoredNow = entries.filter(({ file }) => !isVideo(file)).map(({ file, path }) => path || file.name);
    if (ignoredNow.length > 0) {
      setIgnored((prev) => [...prev, ...ignoredNow]);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    addEntries(
      list.map((file) => ({
        file,
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      })),
    );
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (running || groups) return;
    const entries = await collectFromDataTransfer(e.dataTransfer);
    addEntries(entries);
  }

  function removePicked(id: string) {
    setPicked((prev) => prev.filter((p) => p.id !== id));
  }

  function resetAll() {
    if (running) return;
    setPicked([]);
    setIgnored([]);
    setGroups(null);
    setUnknownFiles([]);
    setWarning(null);
    setFileStates({});
    setGroupRuns({});
    setFinished(false);
    setError(null);
    completedIds.current = new Set();
  }

  // ==========================================================================
  // IDENTIFICAÇÃO
  // ==========================================================================

  async function identify() {
    if (picked.length === 0) return;
    if (picked.length > MAX_IDENTIFY) {
      setError(`Máximo de ${MAX_IDENTIFY} arquivos por identificação. Remova alguns e tente de novo.`);
      return;
    }

    setIdentifying(true);
    setError(null);
    setWarning(null);
    try {
      const snapshot = picked;
      const res = await fetch("/api/admin/smart-upload/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: snapshot.map((p) => ({
            name: p.file.name,
            relativePath: p.path,
            size: p.file.size,
          })),
        }),
      });
      const data = (await res.json().catch(() => null)) as (IdentifyResponse & { error?: string }) | null;
      if (!res.ok || !data) {
        throw new Error(data?.error ?? "Erro ao identificar arquivos");
      }

      setGroups(
        data.groups.map((g) => ({
          key: g.key,
          kind: g.kind,
          title: g.title,
          year: g.year,
          candidates: g.candidates,
          selectedTmdbId: g.selectedTmdbId,
          included: g.selectedTmdbId !== null,
          searchQuery: g.title,
          searching: false,
          searchError: null,
          files: g.files.map((f) => ({
            id: snapshot[f.index].id,
            name: f.name,
            season: f.season,
            episode: f.episode,
            confidence: f.confidence,
          })),
        })),
      );
      setUnknownFiles(data.unknown.map((u) => ({ id: snapshot[u.index].id, name: u.name })));
      setWarning(data.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao identificar arquivos");
    } finally {
      setIdentifying(false);
    }
  }

  // ==========================================================================
  // EDIÇÃO DOS GRUPOS
  // ==========================================================================

  function patchGroup(key: string, patch: Partial<Group>) {
    setGroups((prev) => prev?.map((g) => (g.key === key ? { ...g, ...patch } : g)) ?? prev);
  }

  function changeKind(key: string, kind: GroupKind) {
    setGroups(
      (prev) =>
        prev?.map((g) =>
          g.key === key && g.kind !== kind
            ? { ...g, kind, candidates: [], selectedTmdbId: null, included: false, searchError: null }
            : g,
        ) ?? prev,
    );
  }

  function selectCandidate(key: string, tmdbId: number | null) {
    setGroups(
      (prev) =>
        prev?.map((g) =>
          g.key === key ? { ...g, selectedTmdbId: tmdbId, included: tmdbId !== null } : g,
        ) ?? prev,
    );
  }

  function patchGroupFile(key: string, fileId: string, patch: Partial<GroupFile>) {
    setGroups(
      (prev) =>
        prev?.map((g) =>
          g.key === key ? { ...g, files: g.files.map((f) => (f.id === fileId ? { ...f, ...patch } : f)) } : g,
        ) ?? prev,
    );
  }

  async function manualSearch(e: FormEvent, group: Group) {
    e.preventDefault();
    const q = group.searchQuery.trim();
    if (!q) return;

    patchGroup(group.key, { searching: true, searchError: null });
    try {
      const url = new URL("/api/tmdb/search", window.location.origin);
      url.searchParams.set("q", q);
      url.searchParams.set("type", group.kind === "MOVIE" ? "movie" : "tv");
      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao consultar TMDb");

      const found: Candidate[] = (data.results ?? []).map((r: any) => {
        const y = r.releaseDate ? parseInt(String(r.releaseDate).slice(0, 4), 10) : NaN;
        const overview = typeof r.overview === "string" ? r.overview : "";
        return {
          tmdbId: r.tmdbId,
          name: r.name,
          originalName: r.originalName ?? null,
          year: Number.isNaN(y) ? null : y,
          posterUrl: r.posterUrl ?? null,
          overview: overview.length > 180 ? `${overview.slice(0, 177).trimEnd()}...` : overview,
          existingTitleId: null,
        } satisfies Candidate;
      });

      if (found.length === 0) {
        patchGroup(group.key, { searching: false, searchError: "Nada encontrado no TMDB." });
        return;
      }

      setGroups(
        (prev) =>
          prev?.map((g) => {
            if (g.key !== group.key) return g;
            const merged = [...found];
            for (const c of g.candidates) {
              if (!merged.some((m) => m.tmdbId === c.tmdbId)) merged.push(c);
              else {
                const idx = merged.findIndex((m) => m.tmdbId === c.tmdbId);
                merged[idx] = { ...merged[idx], existingTitleId: c.existingTitleId ?? null };
              }
            }
            return {
              ...g,
              candidates: merged,
              selectedTmdbId: found[0].tmdbId,
              included: true,
              searching: false,
              searchError: null,
            };
          }) ?? prev,
      );
    } catch (err) {
      patchGroup(group.key, {
        searching: false,
        searchError: err instanceof Error ? err.message : "Erro ao consultar TMDb",
      });
    }
  }

  // ==========================================================================
  // ENVIO
  // ==========================================================================

  function setFile(id: string, patch: Partial<FileState>) {
    setFileStates((prev) => ({
      ...prev,
      [id]: { ...({ status: "pending", progress: 0 } as FileState), ...prev[id], ...patch },
    }));
  }

  function setRun(key: string, patch: Partial<GroupRun>) {
    setGroupRuns((prev) => ({ ...prev, [key]: { ...({ status: "pending" } as GroupRun), ...prev[key], ...patch } }));
  }

  async function ensureTitle(group: Group, candidate: Candidate): Promise<TitleInfo> {
    if (candidate.existingTitleId) {
      const res = await fetch(`/api/titles/${candidate.existingTitleId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error(data?.error ?? "Erro ao carregar título existente");
      return { id: data.id, name: data.name, slug: data.slug, type: data.type };
    }

    const res = await fetch("/api/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId: candidate.tmdbId, type: group.kind }),
    });
    const data = await res.json().catch(() => null);

    if (res.status === 409 && data?.title?.id) {
      const t = data.title;
      return { id: t.id, name: t.name, slug: t.slug, type: t.type };
    }
    if (!res.ok || !data?.id) {
      throw new Error(data?.error ?? "Erro ao criar título");
    }
    return { id: data.id, name: data.name, slug: data.slug, type: data.type };
  }

  async function ensureEpisode(titleId: string, season: number, episode: number): Promise<string> {
    const epRes = await fetch("/api/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleId,
        seasonNumber: season,
        episodeNumber: episode,
        name: `Episódio ${episode}`,
      }),
    });
    if (epRes.ok) {
      const data = await epRes.json();
      if (data?.id) return data.id as string;
    }

    // Episódio pode já existir
    const existingRes = await fetch(`/api/episodes?titleId=${titleId}&season=${season}&episode=${episode}`);
    if (existingRes.ok) {
      const data = await existingRes.json();
      if (data?.id) return data.id as string;
    }
    throw new Error(`Não foi possível criar o episódio S${pad2(season)}E${pad2(episode)}`);
  }

  async function startTranscoding(title: TitleInfo): Promise<string> {
    const isSeries = title.type === "SERIES" || title.type === "ANIME";

    if (isSeries) {
      const res = await fetch(`/api/admin/titles/${title.id}/transcode-episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crf, deleteSource }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erro ao iniciar transcodificação");
      const jobCount = (data?.queued ?? data?.jobs)?.length || 0;
      return `Transcodificação iniciada para ${jobCount} episódio(s).`;
    }

    const updateRes = await fetch(`/api/titles/${title.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hlsPath: `titles/${title.slug}/` }),
    });
    if (!updateRes.ok) throw new Error("Erro ao configurar caminho HLS");

    const res = await fetch(`/api/transcode/hls/${title.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crf, deleteSource }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Erro ao iniciar transcodificação");
    return `Transcodificação iniciada (job ${data?.jobId ?? "?"}).`;
  }

  async function sendAll() {
    if (!groups || running) return;

    const queue = groups.filter((g) => g.included && g.selectedTmdbId !== null && g.files.length > 0);
    if (queue.length === 0) {
      setError("Marque pelo menos um grupo com título do TMDB escolhido.");
      return;
    }

    setError(null);
    setRunning(true);
    setFinished(false);

    const pickedById = new Map(picked.map((p) => [p.id, p]));
    const controller = new AbortController();
    controllerRef.current = controller;

    for (const group of queue) {
      const candidate = group.candidates.find((c) => c.tmdbId === group.selectedTmdbId);
      if (!candidate) continue;

      const pending = group.files.filter((f) => !completedIds.current.has(f.id));
      for (const f of pending) setFile(f.id, { status: "pending", progress: 0, error: undefined });
      if (pending.length === 0) {
        setRun(group.key, { status: "done" });
        continue;
      }

      setRun(group.key, { status: "running", message: "Preparando título...", transcodeError: undefined });

      let title: TitleInfo;
      try {
        title = await ensureTitle(group, candidate);
        const isSeriesTitle = title.type === "SERIES" || title.type === "ANIME";
        if (isSeriesTitle !== (group.kind === "SERIES")) {
          throw new Error(`O título "${title.name}" já existe como ${title.type}, diferente do tipo escolhido.`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao preparar título";
        for (const f of pending) setFile(f.id, { status: "error", error: msg });
        setRun(group.key, { status: "error", message: msg });
        continue;
      }

      const isSeries = group.kind === "SERIES";
      const seen = new Set<string>();
      let movieSent = false;
      let sentNow = 0;
      let failed = 0;

      for (const f of pending) {
        const source = pickedById.get(f.id);
        if (!source) {
          setFile(f.id, { status: "error", error: "Arquivo não encontrado na seleção." });
          failed += 1;
          continue;
        }

        try {
          let episodeId: string | undefined;

          if (isSeries) {
            if (!f.season || !f.episode) {
              throw new Error("Informe temporada e episódio.");
            }
            const epKey = `${f.season}x${f.episode}`;
            if (seen.has(epKey)) {
              throw new Error(`Episódio S${pad2(f.season)}E${pad2(f.episode)} repetido neste grupo.`);
            }
            seen.add(epKey);
            setRun(group.key, { message: `Criando S${pad2(f.season)}E${pad2(f.episode)}...` });
            episodeId = await ensureEpisode(title.id, f.season, f.episode);
          } else if (movieSent) {
            setFile(f.id, {
              status: "skipped",
              error: "Mais de um arquivo para o mesmo filme: só o primeiro foi enviado.",
            });
            continue;
          }

          setFile(f.id, { status: "uploading", progress: 0, error: undefined });
          setRun(group.key, { message: `Enviando ${f.name}...` });

          const result = await uploadMultipartFile({
            file: source.file,
            titleId: title.id,
            episodeId,
            controller,
            startTime: Date.now(),
            onProgress: (info) =>
              setFile(f.id, { progress: info.progress, speed: info.uploadSpeed, eta: info.estimatedTimeLeft }),
          });

          if (result === "cancelled") {
            setFile(f.id, { status: "error", error: "Envio cancelado." });
            failed += 1;
            continue;
          }

          completedIds.current.add(f.id);
          setFile(f.id, { status: "completed", progress: 100 });
          sentNow += 1;
          if (!isSeries) movieSent = true;
        } catch (err) {
          setFile(f.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Erro no upload",
          });
          failed += 1;
        }
      }

      let transcode: string | undefined;
      let transcodeError: string | undefined;
      if (autoTranscode && sentNow > 0) {
        setRun(group.key, { message: "Iniciando transcodificação..." });
        try {
          transcode = await startTranscoding(title);
        } catch (err) {
          transcodeError = err instanceof Error ? err.message : "Erro ao iniciar transcodificação";
        }
      }

      setRun(group.key, {
        status: failed > 0 && sentNow === 0 ? "error" : "done",
        message: `${sentNow} enviado(s)${failed > 0 ? `, ${failed} com erro` : ""}.`,
        transcode,
        transcodeError,
      });
    }

    controllerRef.current = null;
    setRunning(false);
    setFinished(true);
  }

  // ==========================================================================
  // DERIVADOS
  // ==========================================================================

  const pickedById = new Map(picked.map((p) => [p.id, p]));
  const queuedGroups = (groups ?? []).filter((g) => g.included && g.selectedTmdbId !== null);
  const queuedFileIds = queuedGroups.flatMap((g) => g.files.map((f) => f.id));
  const totalBytes = queuedFileIds.reduce((sum, id) => sum + (pickedById.get(id)?.file.size ?? 0), 0);
  const doneBytes = queuedFileIds.reduce(
    (sum, id) => sum + (pickedById.get(id)?.file.size ?? 0) * ((fileStates[id]?.progress ?? 0) / 100),
    0,
  );
  const overallPercent = totalBytes > 0 ? Math.round((doneBytes / totalBytes) * 100) : 0;
  const completedCount = queuedFileIds.filter((id) => fileStates[id]?.status === "completed").length;

  const allStates = Object.values(fileStates);
  const summarySent = allStates.filter((s) => s.status === "completed").length;
  const summaryError = allStates.filter((s) => s.status === "error").length;
  const summarySkipped = allStates.filter((s) => s.status === "skipped").length;
  const summaryIgnored = ignored.length + unknownFiles.length + summarySkipped;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-0">
      <div>
        <h2 className="text-2xl font-semibold">Upload Inteligente</h2>
        <p className="text-zinc-400 text-sm">
          Solte uma pasta ou vários arquivos: a IA identifica filmes e episódios, você revisa e envia tudo de uma vez.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/60 p-4 text-red-300 text-sm">{error}</div>
      )}
      {warning && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200">{warning}</div>
      )}

      {/* Etapa 1: escolher arquivos */}
      {!groups && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:p-6 space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-2 border-dashed rounded-lg p-8 sm:p-10 lg:p-12 text-center transition-colors ${
              isDragging ? "border-emerald-600 bg-emerald-950/20" : "border-zinc-700 bg-zinc-900/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,.mkv,.ts"
              onChange={handleInput}
              className="hidden"
              id="smart-file-input"
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              onChange={handleInput}
              className="hidden"
              id="smart-folder-input"
            />
            <div className="space-y-3">
              <p className="text-base sm:text-lg font-semibold text-zinc-100">
                Arraste arquivos ou pastas aqui
              </p>
              <p className="text-xs sm:text-sm text-zinc-400">
                Aceita: .mp4, .mkv, .avi, .mov, .m4v, .webm, .ts (máximo de {MAX_IDENTIFY} por vez)
              </p>
              <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                <label
                  htmlFor="smart-folder-input"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-100 hover:bg-zinc-800"
                >
                  Escolher pasta
                </label>
                <label
                  htmlFor="smart-file-input"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-100 hover:bg-zinc-800"
                >
                  Escolher arquivos
                </label>
              </div>
            </div>
          </div>

          {picked.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-200">
                  {picked.length} vídeo(s) selecionado(s) ({formatBytes(picked.reduce((s, p) => s + p.file.size, 0))})
                </p>
                <button
                  onClick={resetAll}
                  className="text-xs rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800"
                >
                  Limpar
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {picked.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs"
                  >
                    <span className="truncate text-zinc-200" title={p.path}>
                      {p.path}
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="text-zinc-500">{formatBytes(p.file.size)}</span>
                      <button
                        onClick={() => removePicked(p.id)}
                        className="text-red-300 hover:text-red-200"
                        aria-label={`Remover ${p.file.name}`}
                      >
                        Remover
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ignored.length > 0 && (
            <details className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
              <summary className="cursor-pointer">{ignored.length} arquivo(s) ignorado(s) (não são vídeo)</summary>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                {ignored.map((name, i) => (
                  <li key={`${name}-${i}`} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            onClick={identify}
            disabled={picked.length === 0 || identifying}
            className="w-full rounded-md bg-emerald-600 px-6 py-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {identifying ? "Identificando..." : "Identificar com IA"}
          </button>
        </div>
      )}

      {/* Etapa 2: revisão */}
      {groups && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-300">
              {groups.length} grupo(s) identificado(s), {queuedGroups.length} marcado(s) para envio.
            </p>
            <button
              onClick={resetAll}
              disabled={running}
              className="text-xs rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Recomeçar
            </button>
          </div>

          {groups.length === 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
              A IA não identificou nenhum filme ou episódio nos arquivos escolhidos.
            </div>
          )}

          {groups.map((g) => {
            const selected = g.candidates.find((c) => c.tmdbId === g.selectedTmdbId) ?? null;
            const run = groupRuns[g.key];
            const locked = running;
            const exists = Boolean(selected?.existingTitleId);

            return (
              <div
                key={g.key}
                className={`rounded-lg border p-4 sm:p-5 space-y-4 ${
                  g.included ? "border-emerald-800 bg-emerald-950/10" : "border-zinc-800 bg-zinc-950/60 opacity-70"
                }`}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  {selected?.posterUrl ? (
                    <img
                      src={selected.posterUrl}
                      alt={selected.name}
                      className="w-24 h-36 object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-36 rounded bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center text-[11px] text-zinc-500 text-center px-1">
                      Sem capa
                    </div>
                  )}

                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-200">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={g.included}
                          disabled={locked || g.selectedTmdbId === null}
                          onChange={(e) => patchGroup(g.key, { included: e.target.checked })}
                        />
                        Enviar
                      </label>
                      <span className="font-semibold text-zinc-100 truncate">
                        {g.title}
                        {g.year ? ` (${g.year})` : ""}
                      </span>
                      {exists && (
                        <span className="rounded-full border border-sky-700 bg-sky-950/60 px-2 py-0.5 text-[11px] text-sky-200">
                          Já existe no catálogo
                        </span>
                      )}
                      <select
                        value={g.kind}
                        disabled={locked}
                        onChange={(e) => changeKind(g.key, e.target.value as GroupKind)}
                        className="ml-auto rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      >
                        <option value="MOVIE">Filme</option>
                        <option value="SERIES">Série</option>
                      </select>
                    </div>

                    <select
                      value={g.selectedTmdbId ?? ""}
                      disabled={locked || g.candidates.length === 0}
                      onChange={(e) => selectCandidate(g.key, e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    >
                      {g.candidates.length === 0 && <option value="">Nenhum candidato: use a busca manual</option>}
                      {g.candidates.map((c) => (
                        <option key={c.tmdbId} value={c.tmdbId}>
                          {candidateLabel(c)}
                        </option>
                      ))}
                    </select>

                    {selected && (
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {selected.originalName && selected.originalName !== selected.name
                          ? `${selected.originalName}. `
                          : ""}
                        {selected.overview}
                      </p>
                    )}

                    <form onSubmit={(e) => manualSearch(e, g)} className="flex gap-2">
                      <input
                        type="text"
                        value={g.searchQuery}
                        disabled={locked}
                        onChange={(e) => patchGroup(g.key, { searchQuery: e.target.value })}
                        placeholder="Buscar no TMDB (nome ou link do IMDb)"
                        className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500"
                      />
                      <button
                        type="submit"
                        disabled={locked || g.searching}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {g.searching ? "Buscando..." : "Buscar"}
                      </button>
                    </form>
                    {g.searchError && <p className="text-xs text-red-300">{g.searchError}</p>}
                  </div>
                </div>

                {/* Arquivos do grupo */}
                <div className="space-y-1">
                  {g.files.map((f) => {
                    const st = fileStates[f.id];
                    const size = pickedById.get(f.id)?.file.size ?? 0;
                    return (
                      <div
                        key={f.id}
                        className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs space-y-1"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex-1 min-w-[160px] truncate text-zinc-200" title={f.name}>
                            {f.name}
                          </span>
                          <span className="text-zinc-500">{formatBytes(size)}</span>
                          {g.kind === "SERIES" ? (
                            <span className="flex items-center gap-1 text-zinc-400">
                              T
                              <input
                                type="number"
                                min={1}
                                value={f.season ?? ""}
                                disabled={locked}
                                onChange={(e) =>
                                  patchGroupFile(g.key, f.id, {
                                    season: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
                                  })
                                }
                                className="w-14 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-100"
                              />
                              E
                              <input
                                type="number"
                                min={1}
                                value={f.episode ?? ""}
                                disabled={locked}
                                onChange={(e) =>
                                  patchGroupFile(g.key, f.id, {
                                    episode: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
                                  })
                                }
                                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-100"
                              />
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] ${
                              f.confidence >= 80
                                ? "border-emerald-700 text-emerald-300"
                                : f.confidence >= 50
                                  ? "border-amber-700 text-amber-300"
                                  : "border-red-700 text-red-300"
                            }`}
                          >
                            {f.confidence}%
                          </span>
                          {st?.status === "completed" && <span className="text-emerald-300">Enviado</span>}
                          {st?.status === "uploading" && (
                            <span className="text-sky-300">
                              {st.progress}%
                              {st.speed ? ` · ${(st.speed / 1048576).toFixed(1)} MB/s` : ""}
                              {st.eta && st.eta > 0 ? ` · faltam ${formatEta(st.eta)}` : ""}
                            </span>
                          )}
                          {st?.status === "error" && <span className="text-red-300">Erro</span>}
                          {st?.status === "skipped" && <span className="text-zinc-400">Ignorado</span>}
                        </div>
                        {st && (st.status === "uploading" || st.status === "completed") && (
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                st.status === "completed" ? "bg-emerald-500" : "bg-sky-500"
                              }`}
                              style={{ width: `${st.progress}%` }}
                            />
                          </div>
                        )}
                        {st?.error && <p className="text-[11px] text-red-300">{st.error}</p>}
                      </div>
                    );
                  })}
                </div>

                {run && (
                  <div className="text-xs space-y-0.5">
                    {run.message && (
                      <p className={run.status === "error" ? "text-red-300" : "text-zinc-300"}>{run.message}</p>
                    )}
                    {run.transcode && <p className="text-emerald-300">{run.transcode}</p>}
                    {run.transcodeError && <p className="text-red-300">Transcodificação: {run.transcodeError}</p>}
                  </div>
                )}
              </div>
            );
          })}

          {unknownFiles.length > 0 && (
            <details className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
              <summary className="cursor-pointer">
                {unknownFiles.length} arquivo(s) não identificado(s), não serão enviados
              </summary>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                {unknownFiles.map((u) => (
                  <li key={u.id} className="truncate">
                    {u.name}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {ignored.length > 0 && (
            <details className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
              <summary className="cursor-pointer">{ignored.length} arquivo(s) ignorado(s) (não são vídeo)</summary>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                {ignored.map((name, i) => (
                  <li key={`${name}-${i}`} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Opções */}
          <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
            <p className="text-sm font-semibold text-zinc-300">Opções</p>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={autoTranscode}
                disabled={running}
                onChange={(e) => setAutoTranscode(e.target.checked)}
                className="rounded"
              />
              Converter automaticamente após o envio
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={deleteSource}
                disabled={running}
                onChange={(e) => setDeleteSource(e.target.checked)}
                className="rounded"
              />
              Apagar o original após converter
            </label>
            <div className="flex items-center gap-4">
              <label className="text-sm text-zinc-300">CRF (qualidade):</label>
              <input
                type="range"
                min="16"
                max="30"
                value={crf}
                disabled={running}
                onChange={(e) => setCrf(parseInt(e.target.value, 10))}
                className="flex-1"
              />
              <span className="text-sm font-mono text-zinc-400">{crf}</span>
            </div>
          </div>

          {/* Progresso geral */}
          {(running || finished) && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-200">
                  Progresso geral: {completedCount} de {queuedFileIds.length} arquivo(s)
                </span>
                <span className="text-zinc-400">{overallPercent}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${overallPercent}%` }} />
              </div>
            </div>
          )}

          {/* Resumo final */}
          {finished && !running && (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-200 space-y-2">
              <p className="font-semibold">Envio concluído</p>
              <p>
                {summarySent} enviado(s), {summaryError} com erro, {summaryIgnored} ignorado(s).
              </p>
              <Link
                href="/admin/jobs"
                className="inline-flex items-center rounded-md border border-emerald-600/60 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-900/60"
              >
                Abrir HLS Forge (/admin/jobs)
              </Link>
            </div>
          )}

          <button
            onClick={sendAll}
            disabled={running || queuedGroups.length === 0}
            className="w-full rounded-md bg-emerald-600 px-6 py-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {running ? "Enviando..." : finished ? "Reenviar pendentes e com erro" : "Enviar tudo"}
          </button>
        </div>
      )}
    </div>
  );
}

function formatEta(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}
