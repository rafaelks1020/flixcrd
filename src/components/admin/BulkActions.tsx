"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface BulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

export default function BulkActions({
  selectedIds,
  onClearSelection,
  onRefresh,
}: BulkActionsProps) {
  const [loading, setLoading] = useState(false);

  async function handleBulkDelete() {
    if (!confirm(`Deletar ${selectedIds.length} título(s)? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setLoading(true);
    try {
      const promises = selectedIds.map((id) =>
        fetch(`/api/admin/titles/${id}`, { method: "DELETE" })
      );
      await Promise.all(promises);
      toast.success(`✅ ${selectedIds.length} título(s) deletado(s)!`);
      onClearSelection();
      onRefresh();
    } catch (error) {
      toast.error("❌ Erro ao deletar títulos");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkTranscode() {
    if (!confirm(`Iniciar transcodificação de ${selectedIds.length} título(s)?`)) {
      return;
    }

    setLoading(true);
    try {
      const promises = selectedIds.map((id) =>
        fetch(`/api/admin/titles/${id}/transcode`, { method: "POST" })
      );
      await Promise.all(promises);
      toast.success(`✅ ${selectedIds.length} job(s) de transcodificação criado(s)!`);
      onClearSelection();
    } catch (error) {
      toast.error("❌ Erro ao criar jobs");
    } finally {
      setLoading(false);
    }
  }

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur-xl p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-300">
            {selectedIds.length} selecionado(s)
          </span>

          <div className="flex gap-2">
            <button
              onClick={handleBulkTranscode}
              disabled={loading}
              className="group relative rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2 text-xs font-semibold text-white hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 transition-all shadow-lg shadow-blue-900/50"
            >
              🎬 Transcodificar
            </button>

            <button
              onClick={handleBulkDelete}
              disabled={loading}
              className="group relative rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-3 py-2 text-xs font-semibold text-white hover:from-red-500 hover:to-red-600 disabled:opacity-50 transition-all shadow-lg shadow-red-900/50"
            >
              🗑️ Deletar
            </button>

            <button
              onClick={onClearSelection}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
