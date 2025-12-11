"use client";

import { useEffect, useMemo, useState } from "react";

type EmailStatus = "SUCCESS" | "ERROR";

type EmailLog = {
  id: string;
  status: EmailStatus;
  to: string;
  subject: string;
  fromEmail?: string | null;
  fromName?: string | null;
  reason?: string | null;
  errorMessage?: string | null;
  context?: unknown;
  providerResponse?: unknown;
  createdAt: string;
};

type ApiResponse = {
  data: EmailLog[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type EmailLogsSummary = {
  totalLast24h: number;
  successLast24h: number;
  errorLast24h: number;
  totalLast7d: number;
  errorLast7d: number;
  lastErrorAt: string | null;
  topReasonsLast7d: { reason: string; count: number }[];
};

const STATUS_FILTERS: Array<"ALL" | EmailStatus> = ["ALL", "SUCCESS", "ERROR"];

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | EmailStatus>("ALL");
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<EmailLogsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "50");
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    if (reasonFilter.trim()) params.set("reason", reasonFilter.trim());
    return params.toString();
  }, [page, reasonFilter, search, statusFilter]);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      setError(null);
      setSelectedLog(null);
      try {
        const res = await fetch(`/api/admin/email-logs?${queryString}`);
        if (!res.ok) {
          throw new Error("Não foi possível carregar os logs de email");
        }
        const data: ApiResponse = await res.json();
        setLogs(data.data);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } catch (err: any) {
        console.error("Erro ao carregar email logs:", err);
        setError(err?.message || "Erro ao carregar logs");
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [queryString]);

  useEffect(() => {
    async function fetchSummary() {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const res = await fetch("/api/admin/email-logs/summary");
        if (!res.ok) {
          throw new Error("Não foi possível carregar o resumo de logs");
        }
        const data: EmailLogsSummary = await res.json();
        setSummary(data);
      } catch (err: any) {
        console.error("Erro ao carregar resumo de email logs:", err);
        setSummaryError(err?.message || "Erro ao carregar resumo");
      } finally {
        setSummaryLoading(false);
      }
    }

    fetchSummary();
  }, []);

  const statusColor = (status: EmailStatus) =>
    status === "SUCCESS"
      ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700"
      : "bg-red-900/40 text-red-300 border border-red-700";

  const formatDate = (value: string) =>
    new Date(value).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  const formatJson = (value: unknown) => {
    if (!value) return null;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const selectedContextJson = formatJson(selectedLog?.context);
  const selectedProviderJson = formatJson(selectedLog?.providerResponse);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">📧 Logs de Email</h2>
        <p className="text-zinc-400 text-sm">
          Acompanhe envios, falhas e contexto dos emails enviados pelo sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            Últimas 24h
          </div>
          {summaryLoading && !summary ? (
            <div className="mt-2 h-6 w-20 bg-zinc-800 rounded animate-pulse" />
          ) : summaryError ? (
            <div className="mt-2 text-xs text-red-300">{summaryError}</div>
          ) : summary ? (
            <div className="mt-2 space-y-1 text-sm">
              <div className="text-zinc-100 text-lg font-semibold">
                {summary.totalLast24h}
              </div>
              <div className="text-emerald-300 text-xs">
                Sucesso: {summary.successLast24h}
              </div>
              <div className="text-red-300 text-xs">
                Erros: {summary.errorLast24h}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            Últimos 7 dias
          </div>
          {summaryLoading && !summary ? (
            <div className="mt-2 h-6 w-20 bg-zinc-800 rounded animate-pulse" />
          ) : summary ? (
            <div className="mt-2 space-y-1 text-sm">
              <div className="text-zinc-100 text-lg font-semibold">
                {summary.totalLast7d}
              </div>
              <div className="text-red-300 text-xs">
                Erros: {summary.errorLast7d}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-500">Sem dados.</div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            Último erro
          </div>
          {summaryLoading && !summary ? (
            <div className="mt-2 h-6 w-28 bg-zinc-800 rounded animate-pulse" />
          ) : summary && summary.lastErrorAt ? (
            <div className="mt-2 text-sm text-red-300">
              {new Date(summary.lastErrorAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-500">Nenhum erro registrado.</div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            Top reasons (7d)
          </div>
          {summaryLoading && !summary ? (
            <div className="mt-2 space-y-1">
              {[1, 2].map((i) => (
                <div key={i} className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          ) : summary && summary.topReasonsLast7d.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-zinc-200">
              {summary.topReasonsLast7d.map((item) => (
                <li key={item.reason} className="flex items-center justify-between">
                  <span className="truncate max-w-[140px]" title={item.reason}>
                    {item.reason}
                  </span>
                  <span className="text-zinc-400 ml-2">{item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-xs text-zinc-500">Sem dados de reason.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setPage(1);
                  setStatusFilter(s);
                }}
                className={`rounded-md px-3 py-1 text-xs ${
                  statusFilter === s
                    ? "bg-zinc-600 text-white"
                    : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {s === "ALL" ? "Todos" : s === "SUCCESS" ? "Sucesso" : "Erro"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Busca (destinatário, assunto, erro)</label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Ex.: usuario@, 'PIX', 'erro'"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Razão</label>
          <input
            type="text"
            value={reasonFilter}
            onChange={(e) => {
              setPage(1);
              setReasonFilter(e.target.value);
            }}
            placeholder="Ex.: forgot-password, payment-webhook"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page <= 1 || loading}
            className="mr-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            ◀ Página anterior
          </button>
          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page >= totalPages || loading}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            Próxima ▶
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 animate-pulse"
            >
              <div className="h-4 w-48 bg-zinc-800 rounded mb-2" />
              <div className="h-3 w-32 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-200">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-zinc-300">
          Nenhum log encontrado para os filtros atuais.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900/80 text-zinc-300">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assunto</th>
                  <th className="px-4 py-3">Para</th>
                  <th className="px-4 py-3">Razão</th>
                  <th className="px-4 py-3">Erro</th>
                  <th className="px-4 py-3">Criado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`cursor-pointer hover:bg-zinc-900/60 ${
                      selectedLog?.id === log.id ? "bg-zinc-900" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor(log.status)}`}
                      >
                        {log.status === "SUCCESS" ? "Sucesso" : "Erro"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">{log.subject}</div>
                      <div className="text-xs text-zinc-500">{log.fromEmail || "Remetente padrão"}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-200">{log.to}</td>
                    <td className="px-4 py-3 text-zinc-200">
                      {log.reason ? (
                        <span className="rounded-md border border-emerald-800/60 bg-emerald-900/30 px-2 py-1 text-xs text-emerald-200">
                          {log.reason}
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {log.errorMessage ? (
                        <span className="text-red-300 text-xs">{log.errorMessage}</span>
                      ) : (
                        <span className="text-zinc-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-200">{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            {selectedLog ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-zinc-400">Assunto</div>
                    <div className="text-sm text-zinc-100 break-words">
                      {selectedLog.subject}
                    </div>
                    <div className="mt-2 text-xs text-zinc-400">Para</div>
                    <div className="text-sm text-zinc-100 break-words">
                      {selectedLog.to}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor(selectedLog.status)}`}
                  >
                    {selectedLog.status === "SUCCESS" ? "Sucesso" : "Erro"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-300">
                  <div>
                    <div className="text-zinc-400">De</div>
                    <div className="break-words">
                      {selectedLog.fromName || selectedLog.fromEmail
                        ? `${selectedLog.fromName ? `${selectedLog.fromName} ` : ""}${
                            selectedLog.fromEmail ? `<${selectedLog.fromEmail}>` : ""
                          }`
                        : "Remetente padrão"}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Motivo (reason)</div>
                    <div className="break-words">
                      {selectedLog.reason || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Criado em</div>
                    <div>{formatDate(selectedLog.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Erro</div>
                    <div className="break-words text-red-300">
                      {selectedLog.errorMessage || "—"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">
                Selecione um log na tabela acima para ver detalhes.
              </div>
            )}
          </div>

          {selectedLog && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-4 text-xs">
              <div>
                <div className="text-zinc-400">Contexto (JSON)</div>
                {selectedContextJson ? (
                  <pre className="mt-1 max-h-56 overflow-auto rounded bg-zinc-900/80 p-3 text-[11px] text-zinc-100">
                    {selectedContextJson}
                  </pre>
                ) : (
                  <div className="mt-1 text-zinc-500">Sem contexto registrado.</div>
                )}
              </div>
              <div>
                <div className="text-zinc-400">Resposta do provider (JSON)</div>
                {selectedProviderJson ? (
                  <pre className="mt-1 max-h-56 overflow-auto rounded bg-zinc-900/80 p-3 text-[11px] text-zinc-100">
                    {selectedProviderJson}
                  </pre>
                ) : (
                  <div className="mt-1 text-zinc-500">Sem resposta registrada.</div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          Página {page} de {totalPages}
        </span>
        <button
          onClick={() => setPage(1)}
          className="text-emerald-300 hover:text-emerald-200"
          disabled={loading}
        >
          Atualizar
        </button>
      </div>
    </div>
  );
}

