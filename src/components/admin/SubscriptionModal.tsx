"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface Subscription {
  id: string;
  userId: string;
  status: string;
  plan: string | null;
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

        {/* Form */}
        <div className="space-y-4">
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
              <option value="ACTIVE">Ativa</option>
              <option value="CANCELED">Cancelada</option>
              <option value="TRIALING">Trial</option>
              <option value="PAST_DUE">Atrasada</option>
              <option value="PAUSED">Pausada</option>
            </select>
          </div>

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
              <option value="BASIC">Básico</option>
              <option value="PREMIUM">Premium</option>
              <option value="FAMILY">Família</option>
              <option value="TRIAL">Trial</option>
            </select>
          </div>

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
