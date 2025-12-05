"use client";

import { useState } from "react";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warning" | "error";
  message: string;
  details?: string;
}

export default function LogsPage() {
  const [logs] = useState<LogEntry[]>([
    {
      id: "1",
      timestamp: new Date(),
      level: "info",
      message: "Sistema iniciado com sucesso",
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 60000),
      level: "info",
      message: "Upload concluído: Breaking Bad S01E01",
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 120000),
      level: "warning",
      message: "Transcoder com alta carga de processamento",
      details: "CPU: 85%, Memória: 72%",
    },
    {
      id: "4",
      timestamp: new Date(Date.now() - 180000),
      level: "error",
      message: "Falha ao conectar com B2",
      details: "Timeout após 5s",
    },
  ]);

  const [filterLevel, setFilterLevel] = useState<"ALL" | "info" | "warning" | "error">("ALL");

  const filteredLogs = logs.filter((log) => 
    filterLevel === "ALL" ? true : log.level === filterLevel
  );

  function getLevelColor(level: string) {
    switch (level) {
      case "info": return "text-blue-400 bg-blue-900/40 border-blue-700";
      case "warning": return "text-yellow-400 bg-yellow-900/40 border-yellow-700";
      case "error": return "text-red-400 bg-red-900/40 border-red-700";
      default: return "text-zinc-400 bg-zinc-900/40 border-zinc-700";
    }
  }

  function getLevelIcon(level: string) {
    switch (level) {
      case "info": return "ℹ️";
      case "warning": return "⚠️";
      case "error": return "❌";
      default: return "📝";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">📋 Logs do Sistema</h2>
        <p className="text-zinc-400 text-sm">
          Acompanhe eventos, erros e avisos do sistema em tempo real.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterLevel("ALL")}
          className={`rounded-md px-3 py-1 text-xs ${
            filterLevel === "ALL"
              ? "bg-emerald-600 text-white"
              : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Todos ({logs.length})
        </button>
        <button
          onClick={() => setFilterLevel("info")}
          className={`rounded-md px-3 py-1 text-xs ${
            filterLevel === "info"
              ? "bg-blue-600 text-white"
              : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Info ({logs.filter(l => l.level === "info").length})
        </button>
        <button
          onClick={() => setFilterLevel("warning")}
          className={`rounded-md px-3 py-1 text-xs ${
            filterLevel === "warning"
              ? "bg-yellow-600 text-white"
              : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Avisos ({logs.filter(l => l.level === "warning").length})
        </button>
        <button
          onClick={() => setFilterLevel("error")}
          className={`rounded-md px-3 py-1 text-xs ${
            filterLevel === "error"
              ? "bg-red-600 text-white"
              : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Erros ({logs.filter(l => l.level === "error").length})
        </button>
      </div>

      {/* Lista de Logs */}
      <div className="space-y-2">
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className={`rounded-lg border p-3 ${getLevelColor(log.level)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{getLevelIcon(log.level)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-zinc-400">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="text-xs font-semibold uppercase">
                    {log.level}
                  </span>
                </div>
                <p className="text-sm">{log.message}</p>
                {log.details && (
                  <p className="text-xs mt-1 opacity-75">{log.details}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredLogs.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-8 text-center">
          <p className="text-sm text-zinc-500">Nenhum log encontrado com o filtro selecionado.</p>
        </div>
      )}
    </div>
  );
}
