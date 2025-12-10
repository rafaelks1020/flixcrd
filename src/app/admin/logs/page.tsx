"use client";

import { useState, useEffect } from "react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  category: string;
  message: string;
  details?: string;
}

interface ActivityData {
  recentTitles: { id: string; name: string; type: string; createdAt: string }[];
  recentRequests: { id: string; title: string; status: string; createdAt: string }[];
  recentUsers: { id: string; name: string; email: string; createdAt: string }[];
  pendingApprovals: number;
  pendingRequests: number;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<"ALL" | "info" | "warning" | "error" | "success">("ALL");

  useEffect(() => {
    async function loadActivityLogs() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/logs");
        if (!res.ok) throw new Error("Erro ao carregar logs");
        const data: ActivityData = await res.json();
        
        // Converter atividades em logs
        const activityLogs: LogEntry[] = [];
        
        // Títulos recentes
        data.recentTitles.forEach((t) => {
          activityLogs.push({
            id: `title-${t.id}`,
            timestamp: t.createdAt,
            level: "success",
            category: "Catálogo",
            message: `Título adicionado: ${t.name}`,
            details: `Tipo: ${t.type === "MOVIE" ? "Filme" : t.type === "SERIES" ? "Série" : t.type}`,
          });
        });
        
        // Solicitações recentes
        data.recentRequests.forEach((r) => {
          const level = r.status === "COMPLETED" ? "success" : r.status === "REJECTED" ? "error" : "info";
          activityLogs.push({
            id: `request-${r.id}`,
            timestamp: r.createdAt,
            level,
            category: "Solicitações",
            message: `Solicitação: ${r.title}`,
            details: `Status: ${r.status}`,
          });
        });
        
        // Usuários recentes
        data.recentUsers.forEach((u) => {
          activityLogs.push({
            id: `user-${u.id}`,
            timestamp: u.createdAt,
            level: "info",
            category: "Usuários",
            message: `Novo usuário: ${u.name || u.email}`,
            details: u.email,
          });
        });
        
        // Alertas
        if (data.pendingApprovals > 0) {
          activityLogs.push({
            id: "alert-approvals",
            timestamp: new Date().toISOString(),
            level: "warning",
            category: "Sistema",
            message: `${data.pendingApprovals} usuário(s) aguardando aprovação`,
          });
        }
        
        if (data.pendingRequests > 0) {
          activityLogs.push({
            id: "alert-requests",
            timestamp: new Date().toISOString(),
            level: "warning",
            category: "Sistema",
            message: `${data.pendingRequests} solicitação(ões) pendente(s)`,
          });
        }
        
        // Ordenar por data
        activityLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setLogs(activityLogs);
      } catch (err) {
        console.error("Erro ao carregar logs:", err);
        setLogs([{
          id: "error",
          timestamp: new Date().toISOString(),
          level: "error",
          category: "Sistema",
          message: "Erro ao carregar atividades do sistema",
        }]);
      } finally {
        setLoading(false);
      }
    }
    
    loadActivityLogs();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadActivityLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter((log) => 
    filterLevel === "ALL" ? true : log.level === filterLevel
  );

  function getLevelColor(level: string) {
    switch (level) {
      case "info": return "text-blue-400 bg-blue-900/40 border-blue-700";
      case "warning": return "text-yellow-400 bg-yellow-900/40 border-yellow-700";
      case "error": return "text-red-400 bg-red-900/40 border-red-700";
      case "success": return "text-emerald-400 bg-emerald-900/40 border-emerald-700";
      default: return "text-zinc-400 bg-zinc-900/40 border-zinc-700";
    }
  }

  function getLevelIcon(level: string) {
    switch (level) {
      case "info": return "ℹ️";
      case "warning": return "⚠️";
      case "error": return "❌";
      case "success": return "✅";
      default: return "📝";
    }
  }

  function formatTimestamp(ts: string) {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString("pt-BR");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">📋 Atividades do Sistema</h2>
          <p className="text-zinc-400 text-sm">Carregando...</p>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 animate-pulse">
              <div className="h-4 w-48 bg-zinc-800 rounded mb-2" />
              <div className="h-3 w-32 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">📋 Atividades do Sistema</h2>
        <p className="text-zinc-400 text-sm">
          Acompanhe eventos e atividades recentes do sistema.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterLevel("ALL")}
          className={`rounded-md px-3 py-1 text-xs ${
            filterLevel === "ALL"
              ? "bg-zinc-600 text-white"
              : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Todos ({logs.length})
        </button>
        <button
          onClick={() => setFilterLevel("success")}
          className={`rounded-md px-3 py-1 text-xs ${
            filterLevel === "success"
              ? "bg-emerald-600 text-white"
              : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Sucesso ({logs.filter(l => l.level === "success").length})
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-mono text-zinc-400">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {log.category}
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
          <p className="text-sm text-zinc-500">Nenhuma atividade encontrada com o filtro selecionado.</p>
        </div>
      )}
    </div>
  );
}
