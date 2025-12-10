"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface Subscription {
  id: string;
  userId: string;
  status: string;
  plan: string | null;
  price: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

interface SubscriptionModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubscriptionModal({
  userId,
  userName,
  onClose,
  onSuccess,
}: SubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [status, setStatus] = useState("ACTIVE");
  const [plan, setPlan] = useState("BASIC");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  // Preços dos planos
  const planPrices: Record<string, number> = {
    BASIC: 10.00,
    DUO: 14.99,
  };

  useEffect(() => {
    async function loadSubscription() {
      try {
        const res = await fetch("/api/admin/subscriptions");
        if (res.ok) {
          const data = await res.json();
          const userSub = data.subscriptions.find(
            (s: any) => s.userId === userId
          );
          if (userSub) {
            setSubscription(userSub);
            setStatus(userSub.status);
            setPlan(userSub.plan || "BASIC");
            if (userSub.currentPeriodStart) {
              setPeriodStart(
                new Date(userSub.currentPeriodStart).toISOString().split("T")[0]
              );
            }
            if (userSub.currentPeriodEnd) {
              setPeriodEnd(
                new Date(userSub.currentPeriodEnd).toISOString().split("T")[0]
              );
            }
          }
        }
      } catch (error) {
        console.error("Erro ao carregar assinatura:", error);
      }
    }
    loadSubscription();
  }, [userId]);

  // Função para liberar acesso por X dias
  function handleQuickActivate(days: number) {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    
    setPeriodStart(today.toISOString().split("T")[0]);
    setPeriodEnd(endDate.toISOString().split("T")[0]);
    setStatus("ACTIVE");
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          status,
          plan,
          price: planPrices[plan] || 10.00,
          currentPeriodStart: periodStart || null,
          currentPeriodEnd: periodEnd || null,
        }),
      });

      if (res.ok) {
        toast.success("Assinatura salva com sucesso!");
        onSuccess();
        onClose();
      } else {
        toast.error("Erro ao salvar assinatura");
      }
    } catch (error) {
      toast.error("Erro ao salvar assinatura");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!subscription) return;
    if (!confirm("Tem certeza que deseja deletar esta assinatura?")) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/subscriptions/${subscription.id}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        toast.success("Assinatura deletada com sucesso!");
        onSuccess();
        onClose();
      } else {
        toast.error("Erro ao deletar assinatura");
      }
    } catch (error) {
      toast.error("Erro ao deletar assinatura");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">
              {subscription ? "Editar" : "Criar"} Assinatura
            </h2>
            <p className="text-sm text-zinc-400">{userName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Ações Rápidas */}
        <div className="mb-6 p-4 rounded-lg border border-emerald-700/50 bg-emerald-900/20">
          <h3 className="text-sm font-semibold text-emerald-300 mb-3">
            💰 Liberar Acesso Manual (Pagamento em dinheiro/PIX externo)
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleQuickActivate(30)}
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              +30 dias
            </button>
            <button
              type="button"
              onClick={() => handleQuickActivate(60)}
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              +60 dias
            </button>
            <button
              type="button"
              onClick={() => handleQuickActivate(90)}
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              +90 dias
            </button>
            <button
              type="button"
              onClick={() => handleQuickActivate(365)}
              className="rounded-md bg-amber-600 hover:bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              +1 ano
            </button>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Clique para preencher as datas automaticamente. Depois clique em &quot;Salvar&quot;.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Plano e Status lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            {/* Plano */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-300">
                Plano
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600 focus:outline-none"
              >
                <option value="BASIC">Básico (R$ 10/mês - 1 tela)</option>
                <option value="DUO">Duo (R$ 14,99/mês - 2 telas)</option>
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-300">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600 focus:outline-none"
              >
                <option value="ACTIVE">✅ Ativa</option>
                <option value="PENDING">⏳ Pendente</option>
                <option value="CANCELED">❌ Cancelada</option>
                <option value="EXPIRED">⚠️ Expirada</option>
              </select>
            </div>
          </div>

          {/* Período lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            {/* Período Início */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-300">
                Início do Período
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Período Fim */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-300">
                Fim do Período
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Info do período */}
          {periodStart && periodEnd && (
            <div className="text-xs text-zinc-400 bg-zinc-900/50 rounded-md p-2">
              📅 Período: {new Date(periodStart).toLocaleDateString('pt-BR')} até {new Date(periodEnd).toLocaleDateString('pt-BR')}
              {' '}({Math.ceil((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24))} dias)
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
          {subscription && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="rounded-md border border-red-700 bg-red-900/50 px-4 py-2 text-sm text-red-300 hover:bg-red-900 disabled:opacity-50"
            >
              🗑️ Deletar
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="rounded-md border border-emerald-700 bg-emerald-900/50 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-900 disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
