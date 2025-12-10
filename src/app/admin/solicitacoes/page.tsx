"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface AdminRequestItem {
  id: string;
  title: string;
  type: string;
  imdbId: string | null;
  status: string;
  workflowState: string;
  followersCount: number;
  priorityScore: number | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  imdbRating: number | null;
  ageHours: number;
  slaLevel: "LOW" | "MEDIUM" | "HIGH";
  computedPriorityScore: number;
  upload: {
    id: string;
    titleId: string | null;
    completedAt: string | null;
    title: {
      id: string;
      name: string;
      slug: string;
      type: string | null;
    } | null;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  UNDER_REVIEW: "Em análise",
  IN_PRODUCTION: "Em produção",
  UPLOADING: "Upload",
  COMPLETED: "Concluída",
  REJECTED: "Recusada",
};

const TYPE_LABEL: Record<string, string> = {
  MOVIE: "Filme",
  SERIES: "Série",
  ANIME: "Anime",
  DORAMA: "Dorama",
  OTHER: "Outro",
};

export default function AdminSolicitacoesPage() {
  const [items, setItems] = useState<AdminRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterUpload, setFilterUpload] = useState<string>("ALL");
  const [sort, setSort] = useState<string>("priority");

  async function loadData() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.set("type", filterType);
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterUpload === "WITH") params.set("upload", "with");
      if (filterUpload === "WITHOUT") params.set("upload", "without");
      if (sort) params.set("sort", sort);

      const res = await fetch(`/api/admin/solicitacoes?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Erro ao carregar solicitações");
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Erro ao carregar solicitações:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterStatus, filterUpload, sort]);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatSlaBadge(sla: AdminRequestItem["slaLevel"]) {
    if (sla === "HIGH") {
      return (
        <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300 border border-red-500/40">
          SLA alto
        </span>
      );
    }
    if (sla === "MEDIUM") {
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-[11px] text-yellow-200 border border-yellow-500/40">
          SLA médio
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200 border border-emerald-500/30">
        SLA ok
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">📨 Solicitações de Conteúdo</h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Veja todas as solicitações feitas pelos usuários, priorize por SLA, seguidores
            e rating, e direcione o fluxo de atendimento.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? "Carregando..." : "🔄 Atualizar"}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Tipo:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-600 focus:outline-none"
          >
            <option value="ALL">Todos</option>
            <option value="MOVIE">Filmes</option>
            <option value="SERIES">Séries</option>
            <option value="ANIME">Animes</option>
            <option value="DORAMA">Doramas</option>
            <option value="OTHER">Outros</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-600 focus:outline-none"
          >
            <option value="ALL">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="UNDER_REVIEW">Em análise</option>
            <option value="IN_PRODUCTION">Em produção</option>
            <option value="UPLOADING">Upload</option>
            <option value="COMPLETED">Concluída</option>
            <option value="REJECTED">Recusada</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Upload:</span>
          <select
            value={filterUpload}
            onChange={(e) => setFilterUpload(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-600 focus:outline-none"
          >
            <option value="ALL">Todos</option>
            <option value="WITH">Com upload</option>
            <option value="WITHOUT">Sem upload</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Ordenar por:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-600 focus:outline-none"
          >
            <option value="oldest">Mais antigas</option>
            <option value="newest">Mais recentes</option>
            <option value="followers">Mais seguidas</option>
            <option value="sla">SLA</option>
            <option value="priority">Prioridade</option>
          </select>
        </div>
        <div className="ml-auto text-[11px] text-zinc-500">
          {items.length} solicitação{items.length !== 1 ? "es" : ""} carregada(s)
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-zinc-400">Carregando solicitações...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-zinc-500">Nenhuma solicitação encontrada.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left">Título</th>
                  <th className="px-3 py-2 text-left">Usuário</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Workflow</th>
                  <th className="px-3 py-2 text-left">Seguidores</th>
                  <th className="px-3 py-2 text-left">Rating</th>
                  <th className="px-3 py-2 text-left">SLA</th>
                  <th className="px-3 py-2 text-left">Prioridade</th>
                  <th className="px-3 py-2 text-left">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/60">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-zinc-100 flex items-center gap-2">
                        <a
                          href={`/solicitacao/${item.id}`}
                          className="hover:underline"
                          title="Ver detalhes da solicitação (visão usuário)"
                        >
                          {item.title}
                        </a>
                      </div>
                      {item.imdbId && (
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          ID externo: {item.imdbId}
                        </div>
                      )}
                      {item.upload && (
                        <div className="mt-2 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${
                                item.upload.completedAt
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                  : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                              }`}
                              title={
                                item.upload.completedAt
                                  ? `Concluído em ${new Date(item.upload.completedAt).toLocaleString("pt-BR")}`
                                  : "Em progresso / pendente"
                              }
                            >
                              {item.upload.completedAt ? "Upload concluído" : "Upload pendente"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            {item.upload.title && (
                              <a
                                href={`/admin/catalog/${item.upload.title.id}`}
                                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-emerald-200 hover:border-emerald-500 hover:text-emerald-100"
                              >
                                📚 Ver catálogo
                              </a>
                            )}
                            {item.upload.titleId && (
                              <a
                                href={`/admin/upload-v2?titleId=${item.upload.titleId}`}
                                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sky-200 hover:border-sky-500 hover:text-sky-100"
                              >
                                ⬆️ Abrir Upload V2
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-300">
                      {item.user ? (
                        <div>
                          <div>{item.user.name || "Sem nome"}</div>
                          <div className="text-[11px] text-zinc-500">
                            {item.user.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-300">
                      {TYPE_LABEL[item.type] ?? item.type}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <span
                        className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-100"
                      >
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-300">
                      {item.workflowState}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-300">
                      {item.followersCount}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-300">
                      {item.imdbRating ? item.imdbRating.toFixed(1) : "-"}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-300">
                      {formatSlaBadge(item.slaLevel)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-300">
                      {Math.round(item.computedPriorityScore)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-300">
                      {formatDate(item.createdAt)}
                    </td>
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
