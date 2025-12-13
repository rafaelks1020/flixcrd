"use client";

import Link from "next/link";

import Navbar from "@/components/ui/Navbar";

type PaymentItem = {
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
};

type SubscriptionInfo = {
  id: string;
  status: string;
  plan: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  price: number;
};

export default function PaymentsClient({
  isLoggedIn,
  isAdmin,
  subscription,
  payments,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
  subscription: SubscriptionInfo | null;
  payments: PaymentItem[];
}) {
  const hasSubscription = Boolean(subscription);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <Navbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <div className="mx-auto max-w-4xl px-4 pt-24 pb-12">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Pagamentos</h1>
            <p className="text-sm text-zinc-400">
              Histórico de cobranças, boletos e PIX.
            </p>
          </div>

          <Link
            href="/subscribe"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Assinar / Renovar
          </Link>
        </div>

        {!hasSubscription ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-zinc-300">Você ainda não possui assinatura.</p>
            <p className="text-zinc-500 text-sm mt-2">
              Gere um boleto/PIX/cartão em <Link className="text-red-400 hover:text-red-300" href="/subscribe">/subscribe</Link>.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-zinc-500">Plano</div>
                <div className="text-zinc-100 font-semibold">{subscription?.plan}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Status</div>
                <div className="text-zinc-100 font-semibold">{subscription?.status}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Válido até</div>
                <div className="text-zinc-100 font-semibold">
                  {subscription?.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Preço</div>
                <div className="text-zinc-100 font-semibold">
                  R$ {Number(subscription?.price ?? 0).toFixed(2).replace(".", ",")}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold">Histórico</h2>
          </div>

          {payments.length === 0 ? (
            <div className="p-6 text-zinc-400">Nenhum pagamento encontrado.</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {payments.map((p) => (
                <div key={p.id} className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {p.billingType} • {p.status}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Vencimento: {new Date(p.dueDate).toLocaleDateString("pt-BR")} • Criado em: {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold">
                        R$ {Number(p.value).toFixed(2).replace(".", ",")}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Pago em: {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("pt-BR") : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.invoiceUrl ? (
                      <a
                        href={p.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
                      >
                        Abrir boleto / fatura
                      </a>
                    ) : null}

                    {p.pixCopiaECola ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(p.pixCopiaECola || "");
                        }}
                        className="rounded-md bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
                      >
                        Copiar PIX
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
