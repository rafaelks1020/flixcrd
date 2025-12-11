"use client";

import { useEffect, useState } from "react";

interface UploadLogEntry {
  id: string;
  timestamp: string;
  titleId: string | null;
  titleName: string | null;
  fileName: string;
  fileSize: number;
  seasonNumber?: number;
  episodeNumber?: number;
  status: "completed" | "error" | "cancelled";
  errorMessage?: string | null;
}

export default function AdminUploadsPage() {
  const [logs, setLogs] = useState<UploadLogEntry[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("flixcrd:upload-logs");
      if (!raw) {
        setLogs([]);
        return;
      }

      const parsed = JSON.parse(raw) as UploadLogEntry[];
      if (Array.isArray(parsed)) {
        setLogs(parsed);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    }
  }, []);

  const hasLogs = logs.length > 0;

  function clearLogs() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem("flixcrd:upload-logs");
    } catch {}
    setLogs([]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Uploads recentes</h2>
          <p className="text-sm text-zinc-400">
            Histórico local de uploads deste navegador. Para auditoria global, uma futura versão
            poderá usar logs persistidos no backend.
          </p>
        </div>
        {hasLogs && (
          <button
            type="button"
            onClick={clearLogs}
            className="rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/70"
          >
            Limpar histórico
          </button>
        )}
      </div>

      {!hasLogs ? (
        <p className="text-xs text-zinc-500">
          Nenhum upload registrado ainda neste navegador. Após enviar arquivos pelo /admin/upload-v2,
          os últimos uploads aparecerão aqui.
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-xs">
          <div className="flex items-center justify-between mb-2 text-zinc-400">
            <span>{logs.length} registro(s)</span>
          </div>
          <div className="max-h-[520px] overflow-y-auto rounded-md border border-zinc-800">
            <table className="w-full border-collapse text-left">
              <thead className="bg-zinc-900 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Data/Hora</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Arquivo</th>
                  <th className="px-3 py-2">Ep.</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {logs.map((log) => {
                  const date = new Date(log.timestamp);
                  const episodeLabel =
                    typeof log.seasonNumber === "number" &&
                    typeof log.episodeNumber === "number"
                      ? `S${log.seasonNumber.toString().padStart(2, "0")}E${log.episodeNumber
                          .toString()
                          .padStart(2, "0")}`
                      : "-";

                  let statusBadgeClass = "border-zinc-700 text-zinc-300 bg-zinc-900/40";
                  let statusLabel = "-";

                  if (log.status === "completed") {
                    statusBadgeClass = "border-emerald-700 text-emerald-300 bg-emerald-900/40";
                    statusLabel = "Concluído";
                  } else if (log.status === "error") {
                    statusBadgeClass = "border-red-700 text-red-300 bg-red-900/40";
                    statusLabel = "Erro";
                  } else if (log.status === "cancelled") {
                    statusBadgeClass = "border-zinc-600 text-zinc-300 bg-zinc-800/60";
                    statusLabel = "Cancelado";
                  }

                  return (
                    <tr key={log.id} className="align-top text-[11px]">
                      <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                        {Number.isNaN(date.getTime())
                          ? log.timestamp
                          : date.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-zinc-200">
                        {log.titleName || <span className="text-zinc-500">-</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-zinc-100">{log.fileName}</div>
                        <div className="text-[10px] text-zinc-500">{(log.fileSize / (1024 * 1024)).toFixed(2)} MB</div>
                      </td>
                      <td className="px-3 py-2 text-zinc-300">{episodeLabel}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] ${statusBadgeClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-400 max-w-xs break-words">
                        {log.errorMessage || <span className="text-zinc-600">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
