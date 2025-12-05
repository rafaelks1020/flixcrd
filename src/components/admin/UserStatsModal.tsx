"use client";

import { useEffect, useState } from "react";

interface UserStats {
  totalWatchedHours: number;
  totalWatchedMinutes: number;
  favorites: Array<{
    id: string;
    name: string;
    posterUrl: string | null;
    type: string;
  }>;
  lastActivity: {
    date: string;
    title: string;
  } | null;
  mostWatched: Array<{
    id: string;
    name: string;
    posterUrl: string | null;
    type: string;
    viewCount: number;
  }>;
}

interface UserStatsModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

export default function UserStatsModal({
  userId,
  userName,
  onClose,
}: UserStatsModalProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(`/api/admin/users/${userId}/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">
              Estatísticas de Uso
            </h2>
            <p className="text-sm text-zinc-400">{userName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            ✕ Fechar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Tempo Assistido */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="text-sm font-semibold text-zinc-100 mb-3">
                ⏱️ Tempo Total Assistido
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-emerald-400">
                  {stats.totalWatchedHours}
                </span>
                <span className="text-lg text-zinc-400">horas</span>
                <span className="text-sm text-zinc-500">
                  ({stats.totalWatchedMinutes} minutos)
                </span>
              </div>
            </div>

            {/* Último Acesso */}
            {stats.lastActivity && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">
                  🕐 Último Acesso
                </h3>
                <p className="text-xs text-zinc-400">
                  {new Date(stats.lastActivity.date).toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Assistindo: {stats.lastActivity.title}
                </p>
              </div>
            )}

            {/* Mais Assistidos */}
            {stats.mostWatched.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 className="text-sm font-semibold text-zinc-100 mb-3">
                  🔥 Mais Assistidos
                </h3>
                <div className="space-y-2">
                  {stats.mostWatched.map((title) => (
                    <div
                      key={title.id}
                      className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950/50 p-2"
                    >
                      {title.posterUrl ? (
                        <img
                          src={title.posterUrl}
                          alt={title.name}
                          className="h-12 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-8 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">
                          N/A
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-100 truncate">
                          {title.name}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {title.type} · {title.viewCount} visualizações
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Favoritos */}
            {stats.favorites.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 className="text-sm font-semibold text-zinc-100 mb-3">
                  ⭐ Favoritos ({stats.favorites.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {stats.favorites.map((title) => (
                    <div
                      key={title.id}
                      className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2"
                    >
                      {title.posterUrl ? (
                        <img
                          src={title.posterUrl}
                          alt={title.name}
                          className="w-full aspect-[2/3] rounded object-cover mb-1"
                        />
                      ) : (
                        <div className="w-full aspect-[2/3] flex items-center justify-center rounded bg-zinc-800 text-zinc-500 mb-1">
                          🎬
                        </div>
                      )}
                      <p className="text-[10px] font-semibold text-zinc-100 truncate">
                        {title.name}
                      </p>
                      <p className="text-[9px] text-zinc-500">{title.type}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.favorites.length === 0 &&
              stats.mostWatched.length === 0 &&
              !stats.lastActivity && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                  <p className="text-sm text-zinc-500">
                    Usuário ainda não possui atividade registrada.
                  </p>
                </div>
              )}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
            <p className="text-sm text-zinc-500">
              Erro ao carregar estatísticas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
