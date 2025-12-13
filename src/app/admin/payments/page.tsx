"use client";

import { useEffect, useMemo, useState } from "react";

type BillingType = "" | "PIX" | "BOLETO" | "CREDIT_CARD";

interface PaymentRow {
  id: string;
  asaasPaymentId: string;
  status: string;
  value: number;
  billingType: string;
  dueDate: string;
  paymentDate: string | null;
  invoiceUrl: string | null;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
  createdAt: string;
  updatedAt: string;
  subscription: {
    id: string;
    userId: string;
    status: string;
    plan: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    price: number;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  };
}

interface PaymentsResponse {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  items: PaymentRow[];
}

export default function AdminPaymentsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [data, setData] = useState<PaymentsResponse | null>(null);

  const [q, setQ] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");
  const [billingType, setBillingType] = useState<BillingType>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pageSize, setPageSize] = useState(50);

  const page = data?.page || 1;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (userId.trim()) params.set("userId", userId.trim());
    if (status.trim()) params.set("status", status.trim());
    if (billingType) params.set("billingType", billingType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("pageSize", String(pageSize));
    params.set("page", String(page));
    return params.toString();
  }, [q, userId, status, billingType, from, to, pageSize, page]);

  async function load(targetPage?: number) {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const params = new URLSearchParams(queryString);
      if (targetPage) {
        params.set("page", String(targetPage));
      }

      const res = await fetch(`/api/admin/payments?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });

      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();

      if (!contentType.includes("application/json")) {
        const redirectedHint = res.redirected ? ` (redirect para ${res.url})` : "";
        throw new Error(
          `Resposta inválida do servidor (não-JSON)${redirectedHint}. Status ${res.status}.`,
        );
      }

      let json: any = null;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Resposta JSON inválida. Status ${res.status}.`);
      }

      if (!res.ok) {
        throw new Error(json?.error || "Erro ao carregar pagamentos");
      }

      setData(json as PaymentsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pagamentos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
  }, [q, userId, status, billingType, from, to, pageSize]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setInfo("Copiado para a área de transferência.");
      setTimeout(() => setInfo(null), 2000);
    } catch {
      setError("Não foi possível copiar.");
      setTimeout(() => setError(null), 2000);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Pagamentos</h2>
        <p className="text-sm text-zinc-400">
          Histórico de pagamentos (PIX/BOLETO/CARTÃO) com busca por usuário, status e período.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {info}
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-6 md:items-end">
          <div className="space-y-1 md:col-span-2">
            <label className="block text-[11px] text-zinc-300">Buscar</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="email, nome, asaasPaymentId"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-zinc-300">UserId</label>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="cuid..."
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-zinc-300">Status</label>
            <input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="PENDING, RECEIVED, CONFIRMED..."
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-zinc-300">Tipo</label>
            <select
              value={billingType}
              onChange={(e) => setBillingType(e.target.value as BillingType)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
            >
              <option value="">Todos</option>
              <option value="PIX">PIX</option>
              <option value="BOLETO">BOLETO</option>
              <option value="CREDIT_CARD">CARTÃO</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-zinc-300">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-zinc-300">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-zinc-300">Page size</label>
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-50 outline-none focus:border-zinc-500"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          <div className="md:col-span-5" />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setQ("");
                setUserId("");
                setStatus("");
                setBillingType("");
                setFrom("");
                setTo("");
                setPageSize(50);
              }}
              className="rounded-md border border-zinc-700 px-3 py-2 text-[11px] text-zinc-200 hover:bg-zinc-900"
              disabled={loading}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => load(1)}
              className="rounded-md border border-emerald-700 bg-emerald-900/20 px-3 py-2 text-[11px] text-emerald-200 hover:bg-emerald-900/30"
              disabled={loading}
            >
              {loading ? "Carregando..." : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-zinc-400">
            Total: <span className="text-zinc-200">{data?.total ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(Math.max(1, page - 1))}
              disabled={loading || page <= 1}
              className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
            >
              ←
            </button>
            <span className="text-[11px] text-zinc-400">
              Página <span className="text-zinc-100">{data?.page ?? 1}</span> / {data?.pages ?? 1}
            </span>
            <button
              type="button"
              onClick={() => load(Math.min(data?.pages ?? 1, page + 1))}
              disabled={loading || page >= (data?.pages ?? 1)}
              className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
            >
              →
            </button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px]">
            <thead>
              <tr className="text-left text-zinc-400">
                <th className="border-b border-zinc-800 px-2 py-2">Data</th>
                <th className="border-b border-zinc-800 px-2 py-2">Usuário</th>
                <th className="border-b border-zinc-800 px-2 py-2">Plano</th>
                <th className="border-b border-zinc-800 px-2 py-2">Tipo</th>
                <th className="border-b border-zinc-800 px-2 py-2">Status</th>
                <th className="border-b border-zinc-800 px-2 py-2">Valor</th>
                <th className="border-b border-zinc-800 px-2 py-2">Venc.</th>
                <th className="border-b border-zinc-800 px-2 py-2">Links</th>
                <th className="border-b border-zinc-800 px-2 py-2">IDs</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-zinc-500">
                    Nenhum pagamento encontrado.
                  </td>
                </tr>
              ) : (
                (data?.items || []).map((p) => {
                  const created = new Date(p.createdAt);
                  const due = new Date(p.dueDate);
                  const userLabel = p.subscription.user.name
                    ? `${p.subscription.user.name} (${p.subscription.user.email})`
                    : p.subscription.user.email;

                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/40">
                      <td className="border-b border-zinc-900 px-2 py-2 text-zinc-200" suppressHydrationWarning>
                        {created.toLocaleString("pt-BR")}
                      </td>
                      <td className="border-b border-zinc-900 px-2 py-2">
                        <div className="text-zinc-100">{userLabel}</div>
                        <div className="text-zinc-500">{p.subscription.userId}</div>
                      </td>
                      <td className="border-b border-zinc-900 px-2 py-2">
                        <div className="text-zinc-100">{p.subscription.plan}</div>
                        <div className="text-zinc-500">Sub: {p.subscription.status}</div>
                      </td>
                      <td className="border-b border-zinc-900 px-2 py-2 text-zinc-200">{p.billingType}</td>
                      <td className="border-b border-zinc-900 px-2 py-2 text-zinc-200">{p.status}</td>
                      <td className="border-b border-zinc-900 px-2 py-2 text-zinc-200">
                        R$ {Number(p.value).toFixed(2).replace(".", ",")}
                      </td>
                      <td className="border-b border-zinc-900 px-2 py-2 text-zinc-200" suppressHydrationWarning>
                        {due.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="border-b border-zinc-900 px-2 py-2">
                        <div className="flex flex-col gap-1">
                          {p.invoiceUrl ? (
                            <a
                              href={p.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-300 hover:underline"
                            >
                              Abrir boleto/fatura
                            </a>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}

                          {p.pixCopiaECola ? (
                            <button
                              type="button"
                              onClick={() => copyText(p.pixCopiaECola!)}
                              className="text-sky-300 hover:underline text-left"
                            >
                              Copiar PIX
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-b border-zinc-900 px-2 py-2">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => copyText(p.asaasPaymentId)}
                            className="text-zinc-300 hover:underline text-left"
                            title="Copiar ID do gateway"
                          >
                            Copiar ID do gateway
                          </button>
                          <span className="text-zinc-600">{p.asaasPaymentId}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
