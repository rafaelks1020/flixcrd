"use client";

import { useState, useEffect } from "react";

interface Stats {
  titlesCount: number;
  titlesWithHlsCount: number;
  usersCount: number;
  adminsCount: number;
  moviesCount: number;
  seriesCount: number;
  animesCount: number;
  episodesCount: number;
  newUsersInPeriod: number;
  newUsersChange: number;
  titlesInPeriod: number;
  titlesChange: number;
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  pendingApprovals: number;
  activeSubscriptions: number;
  topTitles: {
    id: string;
    name: string;
    posterUrl: string | null;
    type: string;
    rank: number;
    score: number;
  }[];
  uploadsPerDay: { date: string; count: number }[];
}

interface PresenceStats {
  onlineNow: { sessions: number; users: number };
  time: { todaySeconds: number; windowDays: number; windowSeconds: number };
  topUsers: Array<{ user: { id: string; email: string; name: string | null; role: string }; seconds: number }>;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [presence, setPresence] = useState<PresenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/stats?period=${period}`);
        if (!res.ok) throw new Error("Erro ao carregar estatísticas");
        const data = await res.json();
        setStats(data);

        const pRes = await fetch(`/api/admin/presence?windowDays=${encodeURIComponent(period === "7d" ? "7" : period === "30d" ? "30" : "90")}`);
        if (pRes.ok) {
          const p = await pRes.json();
          setPresence(p);
        } else {
          setPresence(null);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
        setPresence(null);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [period]);

  const formatDuration = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatChange = (change: number) => {
    if (change > 0) return <span className="text-emerald-400">+{change}%</span>;
    if (change < 0) return <span className="text-red-400">{change}%</span>;
    return <span className="text-zinc-500">0%</span>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">📊 Analytics</h2>
            <p className="text-zinc-400 text-sm">Carregando estatísticas...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 animate-pulse">
              <div className="h-3 w-20 bg-zinc-800 rounded mb-3" />
              <div className="h-8 w-16 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const maxUpload = Math.max(...stats.uploadsPerDay.map((d) => d.count), 1);
  const maxScore = Math.max(...stats.topTitles.map((t) => t.score), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">📊 Analytics</h2>
          <p className="text-zinc-400 text-sm">
            Estatísticas e métricas do sistema (dados reais).
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as "7d" | "30d" | "90d")}
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
          <p className="text-[11px] uppercase text-zinc-500">Online agora</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{presence?.onlineNow?.users ?? "—"}</p>
          <p className="mt-1 text-xs text-zinc-500">{presence?.onlineNow?.sessions ?? "—"} sessões ativas</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Tempo online hoje</p>
          <p className="mt-2 text-3xl font-semibold text-blue-300">{presence ? formatDuration(presence.time.todaySeconds) : "—"}</p>
          <p className="mt-1 text-xs text-zinc-500">Total agregado (todas as sessões)</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Tempo online ({presence?.time?.windowDays ?? 0}d)</p>
          <p className="mt-2 text-3xl font-semibold text-yellow-300">{presence ? formatDuration(presence.time.windowSeconds) : "—"}</p>
          <p className="mt-1 text-xs text-zinc-500">Janela móvel</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Total de Títulos</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-50">{stats.titlesCount}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {stats.titlesWithHlsCount} com HLS pronto
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Novos Títulos</p>
          <p className="mt-2 text-3xl font-semibold text-blue-300">{stats.titlesInPeriod}</p>
          <p className="mt-1 text-xs">{formatChange(stats.titlesChange)} vs período anterior</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Novos Usuários</p>
          <p className="mt-2 text-3xl font-semibold text-yellow-300">{stats.newUsersInPeriod}</p>
          <p className="mt-1 text-xs">{formatChange(stats.newUsersChange)} vs período anterior</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Assinaturas Ativas</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{stats.activeSubscriptions}</p>
          <p className="mt-1 text-xs text-zinc-500">{stats.usersCount} usuários total</p>
        </div>
      </div>

      {presence?.topUsers?.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">🟢 Top usuários por tempo online ({presence.time.windowDays}d)</h3>
          <div className="space-y-2">
            {presence.topUsers.map((row) => (
              <div key={row.user.id} className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">
                    {row.user.name || row.user.email || row.user.id}
                  </p>
                  <p className="text-xs text-zinc-500">{row.user.role}</p>
                </div>
                <div className="text-sm font-semibold text-emerald-300">{formatDuration(row.seconds)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">📤 Títulos Adicionados (últimos 7 dias)</h3>
          {stats.uploadsPerDay.length === 0 ? (
            <p className="text-xs text-zinc-500">Nenhum título adicionado no período.</p>
          ) : (
            <div className="space-y-2">
              {stats.uploadsPerDay.map((stat) => (
                <div key={stat.date} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-16">{stat.date}</span>
                  <div className="flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${(stat.count / maxUpload) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-300 w-8 text-right">{stat.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">📨 Solicitações</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Total</span>
              <span className="text-sm font-semibold text-zinc-100">{stats.totalRequests}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Pendentes</span>
              <span className="text-sm font-semibold text-yellow-400">{stats.pendingRequests}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Concluídas</span>
              <span className="text-sm font-semibold text-emerald-400">{stats.completedRequests}</span>
            </div>
            <div className="flex justify-between items-center border-t border-zinc-800 pt-3">
              <span className="text-xs text-zinc-400">Aprovações pendentes</span>
              <span className="text-sm font-semibold text-orange-400">{stats.pendingApprovals}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Títulos */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h3 className="text-sm font-semibold mb-3">🏆 Títulos Mais Populares</h3>
        {stats.topTitles.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum título encontrado.</p>
        ) : (
          <div className="space-y-2">
            {stats.topTitles.map((title) => (
              <div
                key={title.id}
                className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-3"
              >
                <span className="text-2xl font-bold text-zinc-600">#{title.rank}</span>
                {title.posterUrl && (
                  <img
                    src={title.posterUrl}
                    alt={title.name}
                    className="w-10 h-14 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-100">{title.name}</p>
                  <p className="text-xs text-zinc-500">
                    {title.type === "MOVIE" ? "Filme" : title.type === "SERIES" ? "Série" : title.type} • Score: {title.score}
                  </p>
                </div>
                <div className="text-right">
                  <div className="h-2 w-24 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600"
                      style={{ width: `${(title.score / maxScore) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estatísticas por Tipo */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">🎬 Filmes</h3>
          <p className="text-3xl font-bold text-blue-400">{stats.moviesCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">📺 Séries</h3>
          <p className="text-3xl font-bold text-purple-400">{stats.seriesCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">🎌 Animes</h3>
          <p className="text-3xl font-bold text-pink-400">{stats.animesCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">📼 Episódios</h3>
          <p className="text-3xl font-bold text-emerald-400">{stats.episodesCount}</p>
        </div>
      </div>
    </div>
  );
}
