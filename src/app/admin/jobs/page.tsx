"use client";

import { useEffect, useState } from "react";

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
}

function formatDate(ts: number) {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function statusLabel(status: string) {
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

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<TranscodeJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const runningJobs = jobs.filter((job) => job.status === "running");
  const queuedJobsOrdered = jobs
    .filter((job) => job.status === "queued")
    .sort((a, b) => a.created_at - b.created_at);
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const errorJobs = jobs.filter((job) => job.status === "error");
  const queuedPositionMap = new Map(queuedJobsOrdered.map((job, index) => [job.id, index + 1]));

  async function loadJobs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transcode/jobs");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao listar jobs");
      }
      setJobs(data as TranscodeJob[]);
      setLastUpdate(new Date());
    } catch (err: any) {
      setError(err.message ?? "Erro ao listar jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      void loadJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Filtrar jobs
  const filteredJobs = jobs.filter((job) => {
    if (filterStatus === "ALL") return true;
    return job.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Jobs de Transcodificação HLS</h2>
        <p className="text-sm text-zinc-400">
          Acompanhe os jobs em fila, em processamento e concluídos no serviço de transcodificação.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Em Processamento</p>
          <p className="mt-2 text-3xl font-semibold text-blue-300">{runningJobs.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Na Fila</p>
          <p className="mt-2 text-3xl font-semibold text-yellow-300">{queuedJobsOrdered.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Concluídos</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{completedJobs.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Com Erro</p>
          <p className="mt-2 text-3xl font-semibold text-red-300">{errorJobs.length}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-zinc-100">Jobs recentes</h3>
            {loading && <span className="text-[10px] text-zinc-500">Atualizando...</span>}
            {lastUpdate && !loading && (
              <span className="text-[10px] text-zinc-500" suppressHydrationWarning>
                Última atualização: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[10px] text-zinc-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-3 w-3 accent-emerald-500"
              />
              Auto-refresh (5s)
            </label>
            <button
              type="button"
              onClick={() => void loadJobs()}
              className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-3 flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-600 focus:outline-none"
          >
            <option value="ALL">Todos os status ({jobs.length})</option>
            <option value="running">🔵 Processando ({runningJobs.length})</option>
            <option value="queued">🟡 Na fila ({queuedJobsOrdered.length})</option>
            <option value="completed">✅ Concluídos ({completedJobs.length})</option>
            <option value="error">❌ Com erro ({errorJobs.length})</option>
          </select>
        </div>

        {filteredJobs.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">
            {filterStatus === "ALL"
              ? "Nenhum job encontrado."
              : `Nenhum job com status "${statusLabel(filterStatus)}".`}
          </p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto rounded-md border border-zinc-800">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-zinc-900 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Progresso</th>
                  <th className="px-3 py-2">Arquivo</th>
                  <th className="px-3 py-2">Criado</th>
                  <th className="px-3 py-2">Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {filteredJobs.map((job) => {
                  const queuePos = queuedPositionMap.get(job.id);
                  return (
                    <tr key={job.id} className="text-[11px]">
                      <td className="px-3 py-2">
                        {job.status === "running" && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-blue-700 bg-blue-900/40 px-2 py-0.5 text-[10px] text-blue-300">
                            🔵 {statusLabel(job.status)}
                          </span>
                        )}
                        {job.status === "queued" && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-yellow-700 bg-yellow-900/40 px-2 py-0.5 text-[10px] text-yellow-300">
                            🟡 {statusLabel(job.status)}
                            {queuePos && ` (#${queuePos})`}
                          </span>
                        )}
                        {job.status === "completed" && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-700 bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-300">
                            ✅ {statusLabel(job.status)}
                          </span>
                        )}
                        {job.status === "error" && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-red-700 bg-red-900/40 px-2 py-0.5 text-[10px] text-red-300">
                            ❌ {statusLabel(job.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {job.status === "running" && (
                          <div className="space-y-1">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full bg-blue-600 transition-all"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-zinc-400">{job.progress.toFixed(1)}%</p>
                          </div>
                        )}
                        {job.status !== "running" && (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-300">
                        <div className="max-w-xs truncate" title={job.source_key}>
                          {job.source_key.split("/").pop() || job.source_key}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{formatDate(job.created_at)}</td>
                      <td className="px-3 py-2 text-zinc-400">
                        {job.message || "-"}
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
