"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  cpfCnpj: string | null;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  subscription: {
    status: string;
    plan: string;
  } | null;
}

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
}

export default function AdminApprovalsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/approvals?status=${activeTab}`);
      if (!res.ok) throw new Error("Erro ao carregar dados");
      const data = await res.json();
      setUsers(data.users || []);
      setStats(data.stats || null);
    } catch (error) {
      toast.error("Erro ao carregar aprovações");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function handleApprove(userId: string) {
    setProcessing(userId);
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "approve" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao aprovar");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(userId: string) {
    setProcessing(userId);
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action: "reject",
          rejectionReason: rejectionReason || "Cadastro não aprovado",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message);
      setShowRejectModal(null);
      setRejectionReason("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao rejeitar");
    } finally {
      setProcessing(null);
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">👥 Aprovação de Usuários</h1>
          <p className="text-zinc-400 text-sm">
            Gerencie os cadastros pendentes de aprovação
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          {loading ? "Carregando..." : "🔄 Atualizar"}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setActiveTab("PENDING")}
            className={`p-4 rounded-xl border transition-all ${
              activeTab === "PENDING"
                ? "bg-yellow-500/10 border-yellow-500 text-yellow-400"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs text-zinc-400">Pendentes</p>
            <p className="text-3xl font-bold">{stats.pending}</p>
          </button>
          <button
            onClick={() => setActiveTab("APPROVED")}
            className={`p-4 rounded-xl border transition-all ${
              activeTab === "APPROVED"
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs text-zinc-400">Aprovados</p>
            <p className="text-3xl font-bold">{stats.approved}</p>
          </button>
          <button
            onClick={() => setActiveTab("REJECTED")}
            className={`p-4 rounded-xl border transition-all ${
              activeTab === "REJECTED"
                ? "bg-red-500/10 border-red-500 text-red-400"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs text-zinc-400">Rejeitados</p>
            <p className="text-3xl font-bold">{stats.rejected}</p>
          </button>
        </div>
      )}

      {/* Users List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">
          {activeTab === "PENDING" && "⏳ Aguardando Aprovação"}
          {activeTab === "APPROVED" && "✅ Usuários Aprovados"}
          {activeTab === "REJECTED" && "❌ Usuários Rejeitados"}
        </h2>

        {loading ? (
          <div className="text-center py-8 text-zinc-500">Carregando...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            {activeTab === "PENDING" && "Nenhum usuário aguardando aprovação 🎉"}
            {activeTab === "APPROVED" && "Nenhum usuário aprovado ainda"}
            {activeTab === "REJECTED" && "Nenhum usuário rejeitado"}
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-lg">
                      {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-100">
                        {user.name || "Sem nome"}
                      </p>
                      <p className="text-sm text-zinc-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
                    {user.phone && <span>📱 {user.phone}</span>}
                    {user.cpfCnpj && <span>🪪 {user.cpfCnpj}</span>}
                    <span>📅 Cadastro: {formatDate(user.createdAt)}</span>
                    {user.approvedAt && (
                      <span>✅ Aprovado: {formatDate(user.approvedAt)}</span>
                    )}
                    {user.subscription && (
                      <span className={`px-2 py-0.5 rounded ${
                        user.subscription.status === "ACTIVE"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {user.subscription.plan} - {user.subscription.status}
                      </span>
                    )}
                    {user.rejectionReason && (
                      <span className="text-red-400">
                        Motivo: {user.rejectionReason}
                      </span>
                    )}
                  </div>
                </div>

                {activeTab === "PENDING" && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleApprove(user.id)}
                      disabled={processing === user.id}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      {processing === user.id ? "..." : "✅ Aprovar"}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(user.id)}
                      disabled={processing === user.id}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      ❌ Rejeitar
                    </button>
                  </div>
                )}

                {activeTab === "REJECTED" && (
                  <button
                    onClick={() => handleApprove(user.id)}
                    disabled={processing === user.id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-lg text-sm font-medium transition-colors ml-4"
                  >
                    {processing === user.id ? "..." : "🔄 Aprovar Agora"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">❌ Rejeitar Usuário</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Informe o motivo da rejeição (opcional):
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Dados incompletos, cadastro duplicado..."
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-red-500 resize-none"
              rows={3}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={processing === showRejectModal}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
              >
                {processing === showRejectModal ? "Rejeitando..." : "Confirmar Rejeição"}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
