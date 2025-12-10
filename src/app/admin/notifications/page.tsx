"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface PushToken {
  id: string;
  userId: string;
  token: string;
  platform: string;
  deviceName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    email: string;
    name: string | null;
  };
}

interface NotificationStats {
  totalTokens: number;
  activeTokens: number;
  androidTokens: number;
  iosTokens: number;
  webTokens: number;
}

export default function AdminNotificationsPage() {
  const [tokens, setTokens] = useState<PushToken[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Form para enviar notificação
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"all" | "active">("active");
  
  // Filtros
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");

  async function loadData(targetPage = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      const res = await fetch(`/api/admin/notifications?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar dados");
      const data = await res.json();
      setTokens(data.tokens || []);
      setStats(data.stats || null);
      setPage(data.page || targetPage);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      toast.error("Erro ao carregar notificações");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      toast.error("Título e mensagem são obrigatórios");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          targetType,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erro ao enviar");
      }

      toast.success(`Notificação enviada para ${data.sent} dispositivos!`);
      setTitle("");
      setMessage("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar notificação";
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  async function handleToggleToken(tokenId: string, isActive: boolean) {
    try {
      const res = await fetch("/api/admin/notifications/tokens", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, isActive: !isActive }),
      });

      if (!res.ok) throw new Error("Erro ao atualizar");
      
      toast.success(isActive ? "Token desativado" : "Token ativado");
      loadData(page);
    } catch {
      toast.error("Erro ao atualizar token");
    }
  }

  async function handleDeleteToken(tokenId: string) {
    if (!confirm("Tem certeza que deseja excluir este token?")) return;

    try {
      const res = await fetch(`/api/admin/notifications/tokens?id=${tokenId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Erro ao excluir");
      
      toast.success("Token excluído");
      loadData(page);
    } catch {
      toast.error("Erro ao excluir token");
    }
  }

  // Filtrar tokens
  const filteredTokens = tokens.filter(token => {
    if (filterPlatform !== "all" && token.platform !== filterPlatform) return false;
    if (filterActive === "active" && !token.isActive) return false;
    if (filterActive === "inactive" && token.isActive) return false;
    return true;
  });

  const platformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "android": return "🤖";
      case "ios": return "🍎";
      case "web": return "🌐";
      default: return "📱";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🔔 Notificações Push</h1>
          <p className="text-zinc-400 text-sm">
            Gerencie tokens de dispositivos e envie notificações
          </p>
        </div>
        <button
          onClick={() => loadData(page)}
          disabled={loading}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          {loading ? "Carregando..." : "🔄 Atualizar"}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs">Total de Tokens</p>
            <p className="text-2xl font-bold">{stats.totalTokens}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs">Tokens Ativos</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.activeTokens}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs">🤖 Android</p>
            <p className="text-2xl font-bold">{stats.androidTokens}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs">🍎 iOS</p>
            <p className="text-2xl font-bold">{stats.iosTokens}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs">🌐 Web</p>
            <p className="text-2xl font-bold">{stats.webTokens}</p>
          </div>
        </div>
      )}

      {/* Send Notification Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">📤 Enviar Notificação</h2>
        <form onSubmit={handleSendNotification} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Novo filme disponível! 🎬"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Destino</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as "all" | "active")}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-emerald-500"
              >
                <option value="active">Apenas dispositivos ativos</option>
                <option value="all">Todos os dispositivos</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Mensagem</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Confira o novo lançamento que acabou de chegar!"
              rows={3}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-zinc-500">
              {stats ? `Será enviado para ${targetType === "active" ? stats.activeTokens : stats.totalTokens} dispositivos` : ""}
            </p>
            <button
              type="submit"
              disabled={sending || !title.trim() || !message.trim()}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {sending ? "Enviando..." : "🚀 Enviar Notificação"}
            </button>
          </div>
        </form>
      </div>

      {/* Tokens List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">📱 Dispositivos Registrados</h2>
          <div className="flex gap-2">
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm"
            >
              <option value="all">Todas plataformas</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
              <option value="web">Web</option>
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-zinc-500">Carregando...</div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            Nenhum dispositivo encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="text-left py-3 px-2">Plataforma</th>
                  <th className="text-left py-3 px-2">Dispositivo</th>
                  <th className="text-left py-3 px-2">Usuário</th>
                  <th className="text-left py-3 px-2">Token</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Registrado</th>
                  <th className="text-right py-3 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map((token) => (
                  <tr key={token.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-3 px-2">
                      <span className="text-lg">{platformIcon(token.platform)}</span>
                      <span className="ml-2 text-xs text-zinc-400">{token.platform}</span>
                    </td>
                    <td className="py-3 px-2">
                      {token.deviceName || <span className="text-zinc-500">-</span>}
                    </td>
                    <td className="py-3 px-2">
                      {token.user ? (
                        <div>
                          <p className="text-zinc-200">{token.user.name || "Sem nome"}</p>
                          <p className="text-xs text-zinc-500">{token.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-zinc-500">ID: {token.userId.slice(0, 8)}...</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <code className="text-xs bg-zinc-800 px-2 py-1 rounded">
                        {token.token.slice(0, 20)}...
                      </code>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        token.isActive 
                          ? "bg-emerald-500/20 text-emerald-400" 
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {token.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-zinc-400 text-xs">
                      {new Date(token.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleToggleToken(token.id, token.isActive)}
                        className={`px-2 py-1 rounded text-xs mr-2 ${
                          token.isActive 
                            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" 
                            : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        }`}
                      >
                        {token.isActive ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => handleDeleteToken(token.id)}
                        className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-xs text-zinc-400">
                <p>
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => loadData(page - 1)}
                    className="px-3 py-1 rounded bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700"
                  >
                    ◀ Anterior
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => loadData(page + 1)}
                    className="px-3 py-1 rounded bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700"
                  >
                    Próxima ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
