"use client";

import { useEffect, useMemo, useState } from "react";

interface ServiceSnapshot {
  id: string;
  name: string;
  ok: boolean;
  details: string | null;
}

interface UptimeSummary {
  healthy: number;
  total: number;
  allHealthy: boolean;
  lastCheckAt: string;
}

interface HistorySnapshot {
  id: string;
  createdAt: string;
  healthy: number;
  total: number;
  allHealthy: boolean;
  services: ServiceSnapshot[];
}

export default function UptimeChart() {
  const [summary, setSummary] = useState<UptimeSummary | null>(null);
  const [services, setServices] = useState<ServiceSnapshot[]>([]);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadCurrentSnapshot();
    loadHistory();

    const interval = setInterval(loadCurrentSnapshot, 60000); // Atualiza snapshot vivo
    return () => clearInterval(interval);
  }, []);

  async function loadCurrentSnapshot() {
    try {
      const res = await fetch("/api/admin/uptime");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || null);
        setServices(data.services || []);
      }
    } catch (error) {
      console.error("Erro ao carregar uptime:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await fetch("/api/admin/uptime/history?limit=48");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || []);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico de uptime:", error);
    } finally {
      setHistoryLoading(false);
    }
  }

  const orderedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [history],
  );

  if (loading && historyLoading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <p className="text-xs text-zinc-500">Carregando status e histórico de uptime...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <p className="text-xs text-zinc-500">Não foi possível carregar o status dos serviços.</p>
      </div>
    );
  }

  const healthyLabel = summary.allHealthy
    ? "Todos os serviços online"
    : `${summary.healthy} de ${summary.total} serviços online`;

  const latestHistory = history[0];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Status dos serviços</h3>
          <p className="text-xs text-zinc-500">
            Snapshot em tempo real + histórico das últimas {orderedHistory.length || 0} checagens
          </p>
        </div>
        <span
          className={`text-xs font-semibold ${
            summary.allHealthy
              ? "text-emerald-400"
              : summary.healthy > 0
              ? "text-yellow-400"
              : "text-red-400"
          }`}
        >
          {healthyLabel}
        </span>
      </div>

      <ul className="space-y-1 text-xs">
        {services.map((service) => (
          <li
            key={service.id}
            className="flex items-center justify-between rounded-md bg-zinc-900/60 px-2 py-1.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  service.ok ? "bg-emerald-400" : "bg-red-500"
                }`}
              />
              <span className="text-zinc-200">{service.name}</span>
            </div>
            <span className="text-zinc-500">
              {service.details || (service.ok ? "OK" : "Problema")}
            </span>
          </li>
        ))}
      </ul>

      <div className="rounded-md border border-zinc-900/80 bg-black/20 p-3">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
          <span>Histórico recente</span>
          {latestHistory ? (
            <span>
              Último snapshot salvo:{" "}
              {new Date(latestHistory.createdAt).toLocaleString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          ) : (
            <span>Nenhum snapshot registrado ainda</span>
          )}
        </div>

        {historyLoading ? (
          <p className="text-xs text-zinc-500">Carregando histórico...</p>
        ) : orderedHistory.length === 0 ? (
          <p className="text-xs text-zinc-500">Sem histórico registrado (cron aguardando primeira execução).</p>
        ) : (
          <div className="grid grid-cols-12 gap-1">
            {orderedHistory.map((snapshot) => (
              <div key={snapshot.id} className="relative group">
                <div
                  className={`h-6 rounded-sm ${
                    snapshot.allHealthy
                      ? "bg-emerald-500/80"
                      : snapshot.healthy > 0
                      ? "bg-yellow-400/80"
                      : "bg-red-500/80"
                  }`}
                />
                <div className="invisible absolute bottom-full left-1/2 z-10 mb-1 w-40 -translate-x-1/2 rounded-md bg-zinc-900 p-2 text-[10px] text-zinc-100 opacity-0 transition group-hover:visible group-hover:opacity-100">
                  <p>
                    {snapshot.healthy}/{snapshot.total} OK
                  </p>
                  <p>{new Date(snapshot.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-zinc-500">
        Última checagem em tempo real: {new Date(summary.lastCheckAt).toLocaleTimeString("pt-BR")}
      </p>
    </div>
  );
}
