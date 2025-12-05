"use client";

import { useState } from "react";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");

  // Dados mockados
  const uploadStats = [
    { date: "01/12", uploads: 5 },
    { date: "02/12", uploads: 8 },
    { date: "03/12", uploads: 3 },
    { date: "04/12", uploads: 12 },
    { date: "05/12", uploads: 7 },
  ];

  const transcodeStats = [
    { date: "01/12", jobs: 3 },
    { date: "02/12", jobs: 6 },
    { date: "03/12", jobs: 2 },
    { date: "04/12", jobs: 10 },
    { date: "05/12", jobs: 5 },
  ];

  const topTitles = [
    { name: "Breaking Bad", views: 1250 },
    { name: "Game of Thrones", views: 980 },
    { name: "The Office", views: 850 },
    { name: "Friends", views: 720 },
    { name: "Stranger Things", views: 650 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">📊 Analytics</h2>
          <p className="text-zinc-400 text-sm">
            Estatísticas e métricas do sistema.
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
        </select>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Total de Views</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-50">4,450</p>
          <p className="mt-1 text-xs text-emerald-400">+12% vs período anterior</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Uploads</p>
          <p className="mt-2 text-3xl font-semibold text-blue-300">35</p>
          <p className="mt-1 text-xs text-emerald-400">+8% vs período anterior</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Transcodificações</p>
          <p className="mt-2 text-3xl font-semibold text-purple-300">26</p>
          <p className="mt-1 text-xs text-red-400">-3% vs período anterior</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Novos Usuários</p>
          <p className="mt-2 text-3xl font-semibold text-yellow-300">18</p>
          <p className="mt-1 text-xs text-emerald-400">+25% vs período anterior</p>
        </div>
      </div>

      {/* Gráficos Simples */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">📤 Uploads por Dia</h3>
          <div className="space-y-2">
            {uploadStats.map((stat) => (
              <div key={stat.date} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-16">{stat.date}</span>
                <div className="flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${(stat.uploads / 12) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-300 w-8 text-right">{stat.uploads}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">🎬 Transcodificações por Dia</h3>
          <div className="space-y-2">
            {transcodeStats.map((stat) => (
              <div key={stat.date} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-16">{stat.date}</span>
                <div className="flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all"
                    style={{ width: `${(stat.jobs / 10) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-300 w-8 text-right">{stat.jobs}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Títulos */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h3 className="text-sm font-semibold mb-3">🏆 Títulos Mais Assistidos</h3>
        <div className="space-y-2">
          {topTitles.map((title, index) => (
            <div
              key={title.name}
              className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <span className="text-2xl font-bold text-zinc-600">#{index + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-100">{title.name}</p>
                <p className="text-xs text-zinc-500">{title.views} visualizações</p>
              </div>
              <div className="text-right">
                <div className="h-2 w-24 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${(title.views / 1250) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estatísticas Adicionais */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">💾 Armazenamento</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Usado</span>
              <span className="text-zinc-300">245 GB</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: "65%" }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">65% de 380 GB</span>
              <span className="text-zinc-500">135 GB livres</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">⚡ Banda</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Usado (mês)</span>
              <span className="text-zinc-300">1.2 TB</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600" style={{ width: "40%" }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">40% de 3 TB</span>
              <span className="text-zinc-500">1.8 TB livres</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">👥 Usuários Ativos</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Online agora</span>
              <span className="text-emerald-400 font-semibold">23</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Hoje</span>
              <span className="text-zinc-300">156</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Esta semana</span>
              <span className="text-zinc-300">892</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
