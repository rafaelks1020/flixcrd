"use client";

import { useEffect, useState } from "react";

interface UptimeData {
  timestamp: string;
  status: "up" | "down";
}

export default function UptimeChart() {
  const [uptimeData, setUptimeData] = useState<UptimeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUptimeData();
    const interval = setInterval(loadUptimeData, 60000); // Atualiza a cada 1 minuto
    return () => clearInterval(interval);
  }, []);

  async function loadUptimeData() {
    try {
      const res = await fetch("/api/admin/uptime");
      if (res.ok) {
        const data = await res.json();
        setUptimeData(data.uptime || []);
      }
    } catch (error) {
      console.error("Erro ao carregar uptime:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <p className="text-xs text-zinc-500">Carregando uptime...</p>
      </div>
    );
  }

  const totalPoints = 24; // 24 horas
  const upCount = uptimeData.filter((d) => d.status === "up").length;
  const uptimePercentage = totalPoints > 0 ? Math.round((upCount / totalPoints) * 100) : 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">
          Uptime (Últimas 24h)
        </h3>
        <span
          className={`text-xs font-semibold ${
            uptimePercentage >= 99
              ? "text-emerald-400"
              : uptimePercentage >= 95
              ? "text-yellow-400"
              : "text-red-400"
          }`}
        >
          {uptimePercentage}%
        </span>
      </div>

      {/* Gráfico de barras */}
      <div className="flex items-end gap-0.5 h-16">
        {Array.from({ length: totalPoints }).map((_, i) => {
          const dataPoint = uptimeData[i];
          const isUp = dataPoint?.status === "up";

          return (
            <div
              key={i}
              className={`flex-1 rounded-t transition-all ${
                isUp
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-red-600 hover:bg-red-500"
              }`}
              style={{
                height: isUp ? "100%" : "20%",
              }}
              title={`${i}h atrás: ${isUp ? "Online" : "Offline"}`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>24h atrás</span>
        <span>Agora</span>
      </div>
    </div>
  );
}
