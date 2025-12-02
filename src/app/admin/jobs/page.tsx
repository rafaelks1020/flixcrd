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
    } catch (err: any) {
      setError(err.message ?? "Erro ao listar jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
    const interval = setInterval(() => {
      void loadJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Jobs de Transcodificação HLS</h2>
        <p className="text-sm text-zinc-400">
          Acompanhe os jobs em fila, em processamento e concluídos no serviço de transcodificação.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">Jobs recentes</h3>
            {loading && <span className="text-[10px] text-zinc-500">Atualizando...</span>}
          </div>
          <button
            type="button"
            onClick={() => void loadJobs()}
            className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
          >
            Recarregar
          </button>
        </div>

        {jobs.length === 0 ? (
          <p className="text-zinc-500 text-xs">Nenhum job registrado ainda.</p>
        ) : (
          <div className="max-h-[520px] overflow-y-auto rounded-md border border-zinc-800">
            <table className="w-full border-collapse text-left">
              <thead className="bg-zinc-900 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Progresso</th>
                  <th className="px-3 py-2">Fonte</th>
                  <th className="px-3 py-2">Destino</th>
                  <th className="px-3 py-2">Criado</th>
                  <th className="px-3 py-2">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {jobs.map((job) => (
                  <tr key={job.id} className="align-top text-[11px]">
                    <td className="px-3 py-2">
                      <div className="font-mono text-[10px] text-zinc-300">{job.id}</div>
                      {job.message && (
                        <div className="mt-1 text-[10px] text-zinc-500 line-clamp-2">
                          {job.message}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          job.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                            : job.status === "error"
                              ? "bg-red-500/15 text-red-300 border border-red-500/40"
                              : job.status === "running"
                                ? "bg-sky-500/15 text-sky-300 border border-sky-500/40"
                                : "bg-zinc-700/30 text-zinc-200 border border-zinc-600/50"
                        }`}
                      >
                        {statusLabel(job.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 w-40">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
                          <div
                            className="h-2 bg-zinc-100"
                            style={{ width: `${Math.max(0, Math.min(100, job.progress ?? 0))}%` }}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums">
                          {Number.isFinite(job.progress) ? `${Math.round(job.progress)}%` : "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      <div className="line-clamp-2 break-all">{job.source_key}</div>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      <div className="line-clamp-2 break-all">{job.dest_prefix}</div>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{formatDate(job.created_at)}</td>
                    <td className="px-3 py-2 text-zinc-400">{formatDate(job.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
