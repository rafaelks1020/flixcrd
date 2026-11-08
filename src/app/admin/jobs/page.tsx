"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ExecutorKind = "desktop" | "vps";

type TelemetryPhase =
  | "queued"
  | "download"
  | "probe"
  | "subtitles"
  | "transcode"
  | "upload"
  | "cleanup"
  | "done"
  | "error";

interface TranscodeAttempt {
  n: number;
  executor: ExecutorKind;
  worker_name: string | null;
  encoder: string | null;
  started_at: number;
  ended_at: number | null;
  result: "running" | "ok" | "error" | "lost";
  error: string | null;
}

interface TranscodeEvent {
  at: number;
  executor: ExecutorKind | null;
  text: string;
}

interface TranscodeTelemetrySource {
  width: number;
  height: number;
  duration_sec: number;
  size_bytes: number | null;
}

interface TranscodeTelemetry {
  phase: TelemetryPhase;
  phase_label: string;
  encoder: string | null;
  rendition: string | null;
  rendition_index: number | null;
  renditions_total: number | null;
  fps: number | null;
  speed_x: number | null;
  out_time_sec: number | null;
  duration_sec: number | null;
  bytes_done: number | null;
  bytes_total: number | null;
  mbps: number | null;
  files_done: number | null;
  files_total: number | null;
  eta_sec: number | null;
  elapsed_sec: number;
  source: TranscodeTelemetrySource | null;
  updated_at: number;
}

interface TranscodeJob {
  id: string;
  status: string;
  progress: number;
  message: string | null;
  bucket: string;
  source_key: string;
  dest_prefix: string;
  created_at: number;
  updated_at: number;
  executor?: ExecutorKind | null;
  worker_name?: string | null;
  desktop_failures?: number;
  attempts?: TranscodeAttempt[] | null;
  events?: TranscodeEvent[] | null;
  telemetry?: TranscodeTelemetry | null;
}

interface TranscodeWorker {
  id: string;
  name: string;
  kind: ExecutorKind;
  online: boolean;
  last_seen: number | null;
  gpu: string | null;
  encoder: string | null;
  version: string | null;
  current_job_id: string | null;
}

function formatNumberPtBr(val: number, decimals = 1): string {
  if (!Number.isFinite(val)) return "0";
  return val.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatBytesPtBr(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumberPtBr(kb, 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${formatNumberPtBr(mb, mb < 10 ? 1 : 0)} MB`;
  }
  const gb = mb / 1024;
  return `${formatNumberPtBr(gb, 1)} GB`;
}

function formatHhMmSs(totalSec: number | null | undefined): string {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec < 0) return "-";
  const secInt = Math.floor(totalSec);
  const h = Math.floor(secInt / 3600);
  const m = Math.floor((secInt % 3600) / 60);
  const s = secInt % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatDurationShort(totalSec: number | null | undefined): string {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec < 0) return "-";
  const secInt = Math.max(0, Math.round(totalSec));
  if (secInt < 60) return `${secInt}s`;
  const h = Math.floor(secInt / 3600);
  const m = Math.floor((secInt % 3600) / 60);
  const s = secInt % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  return d.toLocaleString("pt-BR");
}

function formatTimeLocal(ts: number | null | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("pt-BR");
}

function statusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Em fila";
    case "running":
      return "Processando";
    case "completed":
      return "Concluído";
    case "error":
      return "Erro";
    default:
      return status || "-";
  }
}

function attemptResultLabel(result: TranscodeAttempt["result"]): string {
  switch (result) {
    case "running":
      return "Em andamento";
    case "ok":
      return "Ok";
    case "error":
      return "Erro";
    case "lost":
      return "Sem resposta";
    default:
      return result;
  }
}

function deriveTitleFromDestPrefix(
  destPrefix: string | null | undefined,
  sourceKey: string | null | undefined,
): { readable: string; slug: string | null; fileName: string } {
  const fileName = sourceKey ? sourceKey.split("/").pop() || sourceKey : "-";
  if (!destPrefix) {
    return { readable: fileName, slug: null, fileName };
  }
  const cleaned = destPrefix.replace(/^\/+|\/+$/g, "");
  const match = cleaned.match(/^titles\/([^/]+)/i);
  const rawSlug = match ? match[1] : cleaned.split("/")[0] || cleaned;
  const readable = rawSlug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    readable: readable || rawSlug || fileName,
    slug: rawSlug || null,
    fileName,
  };
}

function buildExecutorBadgeText(
  job: TranscodeJob,
  workers: TranscodeWorker[],
): string {
  const attempts = Array.isArray(job.attempts) ? job.attempts : [];
  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const workerByJob = workers.find((w) => w.current_job_id === job.id);
  const executor: ExecutorKind =
    job.executor ??
    lastAttempt?.executor ??
    workerByJob?.kind ??
    "vps";

  const matchedWorker =
    workerByJob ?? workers.find((w) => w.kind === executor) ?? null;

  const encoder =
    job.telemetry?.encoder ??
    lastAttempt?.encoder ??
    matchedWorker?.encoder ??
    (executor === "desktop" ? "h264_amf" : "libx264");

  if (executor === "desktop") {
    const name =
      job.worker_name ??
      lastAttempt?.worker_name ??
      matchedWorker?.name ??
      "Desktop";
    const gpu = matchedWorker?.gpu ?? "AMD Radeon RX 7600";
    return [name, gpu, encoder].filter(Boolean).join(" · ");
  }

  return ["VPS Contabo", encoder || "libx264"].filter(Boolean).join(" · ");
}

function summarizeCompletedOrErrorJob(job: TranscodeJob): {
  executorText: string;
  durationText: string;
  lastError: string | null;
} {
  const attempts = Array.isArray(job.attempts) ? job.attempts : [];
  const chosenAttempt =
    job.status === "completed"
      ? [...attempts].reverse().find((a) => a.result === "ok") ??
        attempts[attempts.length - 1] ??
        null
      : attempts[attempts.length - 1] ?? null;

  const executor = chosenAttempt?.executor ?? job.executor ?? null;
  const encoder = chosenAttempt?.encoder ?? job.telemetry?.encoder ?? null;

  let executorText = "-";
  if (executor === "desktop") {
    const name = chosenAttempt?.worker_name ?? job.worker_name ?? "Desktop";
    executorText = encoder ? `${name} · ${encoder}` : name;
  } else if (executor === "vps") {
    executorText = `VPS Contabo · ${encoder || "libx264"}`;
  }

  let durationSec: number | null = null;
  if (chosenAttempt && chosenAttempt.started_at) {
    const end = chosenAttempt.ended_at ?? job.updated_at;
    if (end && end >= chosenAttempt.started_at) {
      durationSec = end - chosenAttempt.started_at;
    }
  } else if (
    job.created_at &&
    job.updated_at &&
    job.updated_at >= job.created_at
  ) {
    durationSec = job.updated_at - job.created_at;
  }

  const lastError =
    chosenAttempt?.error ??
    (job.status === "error" ? job.message : null) ??
    null;

  return {
    executorText,
    durationText: durationSec != null ? formatDurationShort(durationSec) : "-",
    lastError,
  };
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<TranscodeJob[]>([]);
  const [workers, setWorkers] = useState<TranscodeWorker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [lastUpdateMs, setLastUpdateMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const isFetchingRef = useRef(false);

  const runningJobs = jobs.filter((job) => job.status === "running");
  const queuedJobsOrdered = jobs
    .filter((job) => job.status === "queued")
    .sort((a, b) => a.created_at - b.created_at);
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const errorJobs = jobs.filter((job) => job.status === "error");
  const queuedPositionMap = new Map(
    queuedJobsOrdered.map((job, index) => [job.id, index + 1]),
  );

  const hasActiveJobs = runningJobs.length > 0 || queuedJobsOrdered.length > 0;
  const pollIntervalSec = hasActiveJobs ? 2 : 10;

  const loadAll = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);

    try {
      const [jobsRes, workersRes] = await Promise.all([
        fetch("/api/transcode/jobs", { cache: "no-store" }),
        fetch("/api/transcode/workers", { cache: "no-store" }).catch(() => null),
      ]);

      const jobsData = (await jobsRes.json().catch(() => null)) as
        | TranscodeJob[]
        | { error?: string }
        | null;

      if (!jobsRes.ok) {
        const errMsg =
          jobsData && !Array.isArray(jobsData) && jobsData.error
            ? jobsData.error
            : "Erro ao listar jobs";
        throw new Error(errMsg);
      }

      if (Array.isArray(jobsData)) {
        setJobs(jobsData);
      }

      if (workersRes && workersRes.ok) {
        const workersData = (await workersRes.json().catch(() => null)) as
          | { workers?: TranscodeWorker[] }
          | TranscodeWorker[]
          | null;
        if (Array.isArray(workersData)) {
          setWorkers(workersData);
        } else if (workersData && Array.isArray(workersData.workers)) {
          setWorkers(workersData.workers);
        }
      }

      setError(null);
      const currentNow = Date.now();
      setLastUpdateMs(currentNow);
      setNowMs(currentNow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao listar jobs");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadAll();
    }, pollIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, pollIntervalSec, loadAll]);

  useEffect(() => {
    const ticker = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const nowSec = nowMs / 1000;
  const updatedAgoSec =
    lastUpdateMs != null ? Math.max(0, Math.floor((nowMs - lastUpdateMs) / 1000)) : null;

  // Monta lista de workers garantindo exibição de Desktop e VPS mesmo em servidor antigo
  const displayWorkers: TranscodeWorker[] = (() => {
    const list = [...workers];
    const hasDesktop = list.some((w) => w.kind === "desktop");
    const hasVps = list.some((w) => w.kind === "vps");

    if (!hasDesktop) {
      list.unshift({
        id: "desktop-default",
        name: "Desktop",
        kind: "desktop",
        online: false,
        last_seen: null,
        gpu: "AMD Radeon RX 7600",
        encoder: "h264_amf",
        version: null,
        current_job_id: null,
      });
    }
    if (!hasVps) {
      list.push({
        id: "vps-contabo",
        name: "VPS (Contabo)",
        kind: "vps",
        online: true,
        last_seen: nowSec,
        gpu: null,
        encoder: "libx264",
        version: null,
        current_job_id:
          runningJobs.find((j) => (j.executor ?? "vps") === "vps")?.id ?? null,
      });
    }
    return list;
  })();

  const anyDesktopOnline = displayWorkers.some(
    (w) => w.kind === "desktop" && w.online,
  );

  const filteredJobs = jobs.filter((job) => {
    if (filterStatus === "ALL") return true;
    return job.status === filterStatus;
  });

  const toggleEvents = (jobId: string) => {
    setExpandedEvents((prev) => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  const toggleDetails = (jobId: string) => {
    setExpandedDetails((prev) => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-100">
            HLS Forge · Transcodificação em Tempo Real
          </h2>
          <p className="text-sm text-zinc-400">
            Acompanhe as máquinas (Desktop GPU e VPS Contabo), telemetria do FFmpeg, fila e histórico de tentativas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {updatedAgoSec != null && (
            <span
              className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-[11px] text-zinc-300"
              suppressHydrationWarning
            >
              Atualizado há {updatedAgoSec}s
            </span>
          )}
          <label className="flex items-center gap-2 text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            Polling automático ({pollIntervalSec}s)
          </label>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-200 hover:bg-zinc-800"
          >
            {loading ? "Atualizando..." : "Atualizar agora"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* 1. Painel Máquinas no topo */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
              Máquinas
            </h3>
            <span className="text-[11px] text-zinc-500">
              ({displayWorkers.length})
            </span>
          </div>

          {!anyDesktopOnline && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              Desktop fora: a VPS converte enquanto isso
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {displayWorkers.map((worker) => {
            const isDesktop = worker.kind === "desktop";
            const seenAgoSec =
              worker.last_seen != null
                ? Math.max(0, Math.floor(nowSec - worker.last_seen))
                : null;
            const currentJob = worker.current_job_id
              ? jobs.find((j) => j.id === worker.current_job_id) ?? null
              : null;
            const currentJobTitle = currentJob
              ? deriveTitleFromDestPrefix(
                  currentJob.dest_prefix,
                  currentJob.source_key,
                ).readable
              : null;

            return (
              <div
                key={worker.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          worker.online
                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                            : "bg-zinc-500"
                        }`}
                      />
                      <span className="text-sm font-semibold text-zinc-100">
                        {isDesktop
                          ? worker.name || "Desktop"
                          : worker.name === "VPS"
                            ? "VPS (Contabo)"
                            : worker.name || "VPS (Contabo)"}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          worker.online
                            ? "border border-emerald-700/60 bg-emerald-950/60 text-emerald-300"
                            : "border border-zinc-700 bg-zinc-800/80 text-zinc-400"
                        }`}
                      >
                        {worker.online ? "Online" : "Offline"}
                      </span>
                    </div>

                    {isDesktop && !worker.online && (
                      <p className="mt-1 text-[11px] text-amber-300/90">
                        Desktop fora: a VPS converte enquanto isso
                      </p>
                    )}
                  </div>

                  {seenAgoSec != null ? (
                    <span
                      className="text-[11px] text-zinc-400"
                      suppressHydrationWarning
                    >
                      visto há {seenAgoSec}s
                    </span>
                  ) : (
                    isDesktop && (
                      <span className="text-[11px] text-zinc-500">
                        sem sinal recente
                      </span>
                    )
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800/80 pt-3 text-[11px]">
                  {isDesktop ? (
                    <div>
                      <span className="text-zinc-500">GPU: </span>
                      <span className="font-medium text-zinc-200">
                        {worker.gpu || "AMD Radeon RX 7600"}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-zinc-500">Tipo: </span>
                      <span className="font-medium text-zinc-200">
                        Servidor VPS (Contabo)
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-zinc-500">Encoder: </span>
                    <span className="font-mono font-medium text-emerald-300">
                      {worker.encoder || (isDesktop ? "h264_amf" : "libx264")}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-zinc-500">Job atual: </span>
                    {worker.current_job_id ? (
                      <span className="font-medium text-blue-300">
                        {currentJobTitle
                          ? `${currentJobTitle} (${worker.current_job_id})`
                          : worker.current_job_id}
                      </span>
                    ) : (
                      <span className="text-zinc-400">Livre</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumo numérico */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Em Processamento</p>
          <p className="mt-2 text-3xl font-semibold text-blue-300">
            {runningJobs.length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Na Fila</p>
          <p className="mt-2 text-3xl font-semibold text-yellow-300">
            {queuedJobsOrdered.length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Concluídos</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">
            {completedJobs.length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Com Erro</p>
          <p className="mt-2 text-3xl font-semibold text-red-300">
            {errorJobs.length}
          </p>
        </div>
      </div>

      {/* 2. Cartões grandes para jobs em andamento */}
      {runningJobs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
            Em Andamento ({runningJobs.length})
          </h3>

          {runningJobs.map((job) => {
            const titleInfo = deriveTitleFromDestPrefix(
              job.dest_prefix,
              job.source_key,
            );
            const executorBadge = buildExecutorBadgeText(job, displayWorkers);
            const t = job.telemetry ?? null;
            const phase: TelemetryPhase = t?.phase ?? "transcode";
            const attempts = Array.isArray(job.attempts) ? job.attempts : [];
            const events = Array.isArray(job.events) ? job.events : [];
            const sortedEvents = [...events].sort((a, b) => b.at - a.at);
            const desktopFailures = job.desktop_failures ?? 0;

            const hasSubtitlesStep =
              phase === "subtitles" ||
              events.some((ev) => /legenda|subtitle/i.test(ev.text));

            const transcodeStepLabel =
              t?.rendition &&
              t?.rendition_index != null &&
              t?.renditions_total != null
                ? `Convertendo ${t.rendition} (${t.rendition_index} de ${t.renditions_total})`
                : t?.phase === "transcode" && t?.phase_label
                  ? t.phase_label
                  : "Convertendo";

            const steps: Array<{ key: string; label: string; phases: TelemetryPhase[] }> = [
              { key: "download", label: "Baixando", phases: ["queued", "download"] },
              { key: "probe", label: "Analisando", phases: ["probe"] },
              ...(hasSubtitlesStep
                ? [{ key: "subtitles", label: "Legendas", phases: ["subtitles" as TelemetryPhase] }]
                : []),
              { key: "transcode", label: transcodeStepLabel, phases: ["transcode"] },
              { key: "upload", label: "Enviando", phases: ["upload", "cleanup"] },
              { key: "done", label: "Concluído", phases: ["done"] },
            ];

            const currentStepIndex = steps.findIndex((s) =>
              s.phases.includes(phase),
            );

            // Métricas dinâmicas (só aparecem quando o valor existe)
            const metrics: Array<{ label: string; value: string }> = [];

            if (t?.fps != null || t?.speed_x != null) {
              const parts: string[] = [];
              if (t?.fps != null) {
                parts.push(`${formatNumberPtBr(t.fps, 1)} fps`);
              }
              if (t?.speed_x != null) {
                parts.push(`${formatNumberPtBr(t.speed_x, 1)}x o tempo real`);
              }
              metrics.push({ label: "Velocidade", value: parts.join(" · ") });
            }

            if (
              t?.mbps != null &&
              (phase === "download" || phase === "upload" || t.mbps > 0)
            ) {
              const mbPerSec = t.mbps / 8;
              metrics.push({
                label: "Taxa de rede",
                value: `${formatNumberPtBr(t.mbps, 1)} Mbps (${formatNumberPtBr(mbPerSec, 2)} MB/s)`,
              });
            }

            if (t?.bytes_done != null || t?.bytes_total != null) {
              const bytesText =
                t.bytes_done != null && t.bytes_total != null
                  ? `${formatBytesPtBr(t.bytes_done)} de ${formatBytesPtBr(t.bytes_total)}`
                  : t.bytes_done != null
                    ? formatBytesPtBr(t.bytes_done)
                    : formatBytesPtBr(t.bytes_total);
              metrics.push({ label: "Bytes", value: bytesText });
            }

            if (t?.files_done != null && t?.files_total != null) {
              metrics.push({
                label: "Arquivos enviados",
                value: `${t.files_done} de ${t.files_total}`,
              });
            }

            const videoDurationSec =
              t?.duration_sec ?? t?.source?.duration_sec ?? null;
            if (t?.out_time_sec != null) {
              metrics.push({
                label: "Posição no vídeo",
                value:
                  videoDurationSec != null
                    ? `${formatHhMmSs(t.out_time_sec)} de ${formatHhMmSs(videoDurationSec)}`
                    : formatHhMmSs(t.out_time_sec),
              });
            }

            if (t?.elapsed_sec != null) {
              metrics.push({
                label: "Tempo decorrido",
                value: `${formatDurationShort(t.elapsed_sec)} (${formatHhMmSs(t.elapsed_sec)})`,
              });
            }

            if (t?.eta_sec != null && t.eta_sec >= 0) {
              metrics.push({
                label: "Tempo restante estimado",
                value: formatDurationShort(t.eta_sec),
              });
            }

            if (t?.source != null) {
              const srcParts = [
                `${t.source.width}x${t.source.height}`,
                formatHhMmSs(t.source.duration_sec),
              ];
              if (t.source.size_bytes != null) {
                srcParts.push(formatBytesPtBr(t.source.size_bytes));
              }
              metrics.push({
                label: "Origem (resolução e duração)",
                value: srcParts.join(" · "),
              });
            }

            const progressClamped = Math.max(
              0,
              Math.min(100, Number(job.progress) || 0),
            );
            const isEventsOpen = expandedEvents[job.id] ?? false;

            return (
              <div
                key={job.id}
                className="rounded-lg border border-blue-800/60 bg-zinc-950/80 p-5 shadow-lg"
              >
                {/* Cabeçalho do Job */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-700 bg-blue-950/60 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                        Processando
                      </span>
                      <h4 className="text-lg font-semibold text-zinc-100">
                        {titleInfo.readable}
                      </h4>
                      {titleInfo.slug && (
                        <span className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-400">
                          {titleInfo.slug}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Arquivo de origem:{" "}
                      <span className="font-mono text-zinc-300">
                        {job.source_key}
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Destino:{" "}
                      <span className="font-mono text-zinc-400">
                        {job.dest_prefix}
                      </span>{" "}
                      · ID: <span className="font-mono">{job.id}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300">
                      {executorBadge}
                    </span>
                    <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
                      Falhas no Desktop: {desktopFailures} de 2
                    </span>
                  </div>
                </div>

                {/* Linha de etapas */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {steps.map((step, idx) => {
                    const isCurrent = idx === currentStepIndex;
                    const isDone =
                      currentStepIndex > -1 && idx < currentStepIndex;
                    return (
                      <div key={step.key} className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            isCurrent
                              ? "border border-blue-500 bg-blue-600/20 text-blue-200 shadow-sm"
                              : isDone
                                ? "border border-emerald-800/60 bg-emerald-950/30 text-emerald-400"
                                : "border border-zinc-800 bg-zinc-900/50 text-zinc-500"
                          }`}
                        >
                          {isDone ? "✓ " : ""}
                          {step.label}
                        </span>
                        {idx < steps.length - 1 && (
                          <span className="text-xs text-zinc-600">→</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Barra de progresso com % */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">
                      {t?.phase_label || job.message || "Processando..."}
                    </span>
                    <span className="font-semibold text-blue-300">
                      {formatNumberPtBr(progressClamped, 1)}%
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${progressClamped}%` }}
                    />
                  </div>
                </div>

                {/* Grade de métricas (só aparece quando há valores) */}
                {metrics.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {metrics.map((m) => (
                      <div
                        key={m.label}
                        className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                      >
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                          {m.label}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-zinc-200">
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Tentativas */}
                <div className="mt-4 border-t border-zinc-800/80 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">
                      Tentativas ({attempts.length})
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Falhas no Desktop: {desktopFailures} de 2
                    </span>
                  </div>

                  {attempts.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">
                      Nenhuma tentativa registrada ainda.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded border border-zinc-800">
                      <table className="w-full border-collapse text-left text-[11px]">
                        <thead className="bg-zinc-900 text-zinc-400">
                          <tr>
                            <th className="px-2.5 py-1.5">#</th>
                            <th className="px-2.5 py-1.5">Executor</th>
                            <th className="px-2.5 py-1.5">Encoder</th>
                            <th className="px-2.5 py-1.5">Início</th>
                            <th className="px-2.5 py-1.5">Duração</th>
                            <th className="px-2.5 py-1.5">Resultado</th>
                            <th className="px-2.5 py-1.5">Erro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                          {attempts.map((att) => {
                            const durSec =
                              att.started_at != null
                                ? Math.max(
                                    0,
                                    (att.ended_at ?? nowSec) - att.started_at,
                                  )
                                : null;
                            return (
                              <tr key={att.n}>
                                <td className="px-2.5 py-1.5 text-zinc-400">
                                  #{att.n}
                                </td>
                                <td className="px-2.5 py-1.5 text-zinc-200">
                                  {att.executor === "desktop"
                                    ? att.worker_name || "Desktop"
                                    : "VPS Contabo"}
                                </td>
                                <td className="px-2.5 py-1.5 font-mono text-zinc-300">
                                  {att.encoder || "-"}
                                </td>
                                <td className="px-2.5 py-1.5 text-zinc-400">
                                  {formatDate(att.started_at)}
                                </td>
                                <td
                                  className="px-2.5 py-1.5 text-zinc-300"
                                  suppressHydrationWarning
                                >
                                  {formatDurationShort(durSec)}
                                </td>
                                <td className="px-2.5 py-1.5">
                                  <span
                                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                      att.result === "ok"
                                        ? "bg-emerald-950/60 text-emerald-300"
                                        : att.result === "running"
                                          ? "bg-blue-950/60 text-blue-300"
                                          : att.result === "lost"
                                            ? "bg-amber-950/60 text-amber-300"
                                            : "bg-red-950/60 text-red-300"
                                    }`}
                                  >
                                    {attemptResultLabel(att.result)}
                                  </span>
                                </td>
                                <td className="px-2.5 py-1.5 text-red-300">
                                  {att.error || "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 4. Histórico de eventos (recolhível, mais recentes em cima) */}
                <div className="mt-3 border-t border-zinc-800/80 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleEvents(job.id)}
                    className="flex items-center gap-2 text-xs font-medium text-zinc-300 hover:text-white"
                  >
                    <span>{isEventsOpen ? "▼" : "▶"}</span>
                    <span>Histórico de eventos ({sortedEvents.length})</span>
                  </button>

                  {isEventsOpen && (
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-900/60 p-2.5 text-[11px]">
                      {sortedEvents.length === 0 ? (
                        <p className="text-zinc-500">Nenhum evento registrado.</p>
                      ) : (
                        sortedEvents.map((ev, idx) => (
                          <div
                            key={`${ev.at}-${idx}`}
                            className="flex items-start gap-2 border-b border-zinc-800/50 pb-1 last:border-b-0 last:pb-0"
                          >
                            <span
                              className="shrink-0 font-mono text-zinc-500"
                              suppressHydrationWarning
                            >
                              {formatTimeLocal(ev.at)}
                            </span>
                            {ev.executor && (
                              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-300">
                                {ev.executor === "desktop" ? "Desktop" : "VPS"}
                              </span>
                            )}
                            <span className="text-zinc-200">{ev.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Lista geral (Fila, Concluídos, Com Erro e Todos) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-zinc-100">
              Fila e Histórico de Jobs
            </h3>
            {loading && (
              <span className="text-[10px] text-zinc-500">Atualizando...</span>
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-emerald-600 focus:outline-none"
            >
              <option value="ALL">Todos os status ({jobs.length})</option>
              <option value="running">
                Processando ({runningJobs.length})
              </option>
              <option value="queued">
                Na fila ({queuedJobsOrdered.length})
              </option>
              <option value="completed">
                Concluídos ({completedJobs.length})
              </option>
              <option value="error">Com erro ({errorJobs.length})</option>
            </select>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">
            {filterStatus === "ALL"
              ? "Nenhum job encontrado."
              : `Nenhum job com status "${statusLabel(filterStatus)}".`}
          </p>
        ) : (
          <div className="max-h-[650px] overflow-y-auto rounded-md border border-zinc-800">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-zinc-900 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Status / Destino</th>
                  <th className="px-3 py-2">Título / Arquivo</th>
                  <th className="px-3 py-2">Executor / Duração</th>
                  <th className="px-3 py-2">Falhas Desktop</th>
                  <th className="px-3 py-2">Criado</th>
                  <th className="px-3 py-2">Mensagem / Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {filteredJobs.map((job) => {
                  const queuePos = queuedPositionMap.get(job.id);
                  const titleInfo = deriveTitleFromDestPrefix(
                    job.dest_prefix,
                    job.source_key,
                  );
                  const desktopFailures = job.desktop_failures ?? 0;
                  const goesToVps = !anyDesktopOnline || desktopFailures >= 2;
                  const summary = summarizeCompletedOrErrorJob(job);
                  const attempts = Array.isArray(job.attempts)
                    ? job.attempts
                    : [];
                  const events = Array.isArray(job.events) ? job.events : [];
                  const sortedEvents = [...events].sort((a, b) => b.at - a.at);
                  const isDetailsOpen = expandedDetails[job.id] ?? false;

                  return (
                    <tr key={job.id} className="align-top text-[11px]">
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          {job.status === "running" && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-blue-700 bg-blue-900/40 px-2 py-0.5 text-[10px] text-blue-300">
                              Processando ({formatNumberPtBr(job.progress || 0, 1)}%)
                            </span>
                          )}
                          {job.status === "queued" && (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-md border border-yellow-700 bg-yellow-900/40 px-2 py-0.5 text-[10px] font-medium text-yellow-200">
                                {goesToVps
                                  ? "Na fila: vai para a VPS"
                                  : "Na fila: vai para o Desktop"}
                                {queuePos ? ` (#${queuePos})` : ""}
                              </span>
                            </>
                          )}
                          {job.status === "completed" && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-700 bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-300">
                              Concluído
                            </span>
                          )}
                          {job.status === "error" && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-red-700 bg-red-900/40 px-2 py-0.5 text-[10px] text-red-300">
                              Erro
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-zinc-200">
                        <div className="font-semibold text-zinc-100">
                          {titleInfo.readable}
                        </div>
                        <div
                          className="max-w-xs truncate font-mono text-[10px] text-zinc-400"
                          title={job.source_key}
                        >
                          {titleInfo.fileName}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-zinc-300">
                        {job.status === "running" ? (
                          <div>
                            <div className="font-medium text-emerald-300">
                              {buildExecutorBadgeText(job, displayWorkers)}
                            </div>
                            {job.telemetry?.elapsed_sec != null && (
                              <div className="text-[10px] text-zinc-400">
                                Decorrido:{" "}
                                {formatDurationShort(job.telemetry.elapsed_sec)}
                              </div>
                            )}
                          </div>
                        ) : job.status === "queued" ? (
                          <span className="text-zinc-500">Aguardando vaga</span>
                        ) : (
                          <div>
                            <div className="font-medium text-zinc-200">
                              {summary.executorText}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              Tempo: {summary.durationText}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-zinc-300">
                        Falhas no Desktop: {desktopFailures} de 2
                      </td>

                      <td className="px-3 py-2.5 text-zinc-400">
                        {formatDate(job.created_at)}
                      </td>

                      <td className="px-3 py-2.5 text-zinc-300">
                        <div className="space-y-1">
                          <div>
                            {summary.lastError ? (
                              <span className="text-red-300">
                                {summary.lastError}
                              </span>
                            ) : (
                              job.message || "-"
                            )}
                          </div>

                          {(attempts.length > 0 || sortedEvents.length > 0) && (
                            <button
                              type="button"
                              onClick={() => toggleDetails(job.id)}
                              className="text-[10px] font-medium text-blue-400 hover:underline"
                            >
                              {isDetailsOpen
                                ? "Ocultar tentativas e eventos"
                                : `Ver tentativas (${attempts.length}) e eventos (${sortedEvents.length})`}
                            </button>
                          )}

                          {isDetailsOpen && (
                            <div className="mt-2 space-y-2 rounded border border-zinc-800 bg-zinc-900/70 p-2 text-[10px]">
                              {attempts.length > 0 && (
                                <div>
                                  <p className="mb-1 font-semibold text-zinc-300">
                                    Tentativas:
                                  </p>
                                  <div className="space-y-1">
                                    {attempts.map((att) => {
                                      const dur =
                                        att.started_at != null
                                          ? Math.max(
                                              0,
                                              (att.ended_at ?? nowSec) -
                                                att.started_at,
                                            )
                                          : null;
                                      return (
                                        <div
                                          key={att.n}
                                          className="flex flex-wrap items-center gap-2 text-zinc-300"
                                        >
                                          <span className="font-mono">
                                            #{att.n}
                                          </span>
                                          <span>
                                            {att.executor === "desktop"
                                              ? att.worker_name || "Desktop"
                                              : "VPS Contabo"}
                                          </span>
                                          <span className="font-mono text-zinc-400">
                                            {att.encoder || "-"}
                                          </span>
                                          <span>{formatDate(att.started_at)}</span>
                                          <span>{formatDurationShort(dur)}</span>
                                          <span className="font-semibold">
                                            [{attemptResultLabel(att.result)}]
                                          </span>
                                          {att.error && (
                                            <span className="text-red-300">
                                              {att.error}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {sortedEvents.length > 0 && (
                                <div>
                                  <p className="mb-1 font-semibold text-zinc-300">
                                    Eventos recentes:
                                  </p>
                                  <div className="max-h-36 space-y-1 overflow-y-auto">
                                    {sortedEvents.map((ev, idx) => (
                                      <div
                                        key={`${ev.at}-${idx}`}
                                        className="flex items-start gap-1.5 text-zinc-300"
                                      >
                                        <span
                                          className="shrink-0 font-mono text-zinc-500"
                                          suppressHydrationWarning
                                        >
                                          {formatTimeLocal(ev.at)}
                                        </span>
                                        {ev.executor && (
                                          <span className="shrink-0 rounded bg-zinc-800 px-1 text-zinc-400">
                                            {ev.executor === "desktop"
                                              ? "Desktop"
                                              : "VPS"}
                                          </span>
                                        )}
                                        <span>{ev.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
