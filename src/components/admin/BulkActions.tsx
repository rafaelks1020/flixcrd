"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface BulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
  transcodeOptions?: { crf?: number; deleteSource?: boolean };
  titleTypes?: Record<string, string>;
}

export default function BulkActions({
  selectedIds,
  onClearSelection,
  onRefresh,
  transcodeOptions,
  titleTypes,
}: BulkActionsProps) {
  const [loading, setLoading] = useState(false);

  async function handleBulkDelete() {
    if (!confirm(`Deletar ${selectedIds.length} título(s)? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setLoading(true);
    try {
      const promises = selectedIds.map((id) =>
        fetch(`/api/titles/${id}`, { method: "DELETE" })
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
    const body = JSON.stringify({
      ...(typeof transcodeOptions?.crf === "number" ? { crf: transcodeOptions.crf } : {}),
      deleteSource: Boolean(transcodeOptions?.deleteSource),
    });
    const post = (url: string) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });

    let queued = 0;
    let skipped = 0;
    const failures: string[] = [];

    // Todos ao mesmo tempo: as rotas só enfileiram e respondem na hora; a fila faz o resto.
    await Promise.all(
      selectedIds.map(async (id) => {
        try {
          const type = titleTypes?.[id];
          const isSeries = type ? type === "SERIES" || type === "ANIME" : true;
          let res = await post(
            isSeries ? `/api/admin/titles/${id}/transcode-episodes` : `/api/transcode/hls/${id}`,
          );
          let data: any = await res.json().catch(() => ({}));
          let movie = !isSeries;
          if (!type && res.status === 400 && String(data?.error ?? "").includes("séries")) {
            res = await post(`/api/transcode/hls/${id}`);
            data = await res.json().catch(() => ({}));
            movie = true;
          }
          if (!res.ok) {
            failures.push(data?.error ?? `HTTP ${res.status}`);
            return;
          }
          if (movie) {
            if (data?.jobId) queued += 1;
            return;
          }
          queued += data?.background
            ? Number(data?.episodesWithPrefix ?? 0)
            : Array.isArray(data?.queued) ? data.queued.length : 0;
          skipped += Array.isArray(data?.skipped) ? data.skipped.length : 0;
        } catch (error) {
          failures.push(error instanceof Error ? error.message : "erro de rede");
        }
      }),
    );

    setLoading(false);
    if (queued > 0) {
      toast.success(
        `${queued} conversão(ões) enviadas para a fila.${skipped ? ` ${skipped} ignorada(s).` : ""} Acompanhe em HLS Forge (já na fila não duplica).`,
        { duration: 8000 },
      );
    }
    if (failures.length > 0) {
      toast.error(`${failures.length} falha(s): ${failures[0]}`, { duration: 10000 });
    }
    if (queued === 0 && failures.length === 0) {
      toast(`Nada para converter.${skipped ? ` ${skipped} ignorado(s) (já convertido ou sem arquivo).` : ""}`);
    }
    if (queued > 0) {
      onClearSelection();
      onRefresh();
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
