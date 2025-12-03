"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FavoriteButtonProps {
  titleId: string;
  initialIsFavorite: boolean;
}

export default function FavoriteButton({
  titleId,
  initialIsFavorite,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const method = isFavorite ? "DELETE" : "POST";
      const res = await fetch("/api/user/favorites", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao atualizar Minha lista.");
      }

      setIsFavorite(!isFavorite);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Erro ao atualizar Minha lista.");
    } finally {
      setLoading(false);
    }
  }

  const baseClasses =
    "rounded-md border px-4 py-2 text-xs font-semibold transition disabled:opacity-60";
  const activeClasses =
    "border-emerald-500 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/60";
  const inactiveClasses =
    "border-zinc-600 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800";

  const label = isFavorite ? "Remover da Minha lista" : "Adicionar à Minha lista";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`${baseClasses} ${isFavorite ? activeClasses : inactiveClasses}`}
      >
        {loading ? "Atualizando..." : label}
      </button>
      {error && (
        <p className="text-[11px] text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
