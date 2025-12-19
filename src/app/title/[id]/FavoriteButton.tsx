"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  titleId: string;
  initialIsFavorite: boolean;
  className?: string;
}

export default function FavoriteButton({
  titleId,
  initialIsFavorite,
  className,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const router = useRouter();

  // Carrega o profileId ativo do localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem("activeProfileId");
    if (!stored) {
      setProfileId(null);
      return;
    }

    setProfileId(stored);
  }, []);

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      if (!profileId) {
        setError("Selecione um perfil.");
        router.push("/profiles");
        return;
      }

      const method = isFavorite ? "DELETE" : "POST";
      const res = await fetch("/api/user/favorites", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId, profileId }),
      });

      const data = await res.json();

      if (res.status === 404 && data?.error === "Perfil não encontrado.") {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("activeProfileId");
        }
        setProfileId(null);
        setError("Perfil não existe mais.");
        router.push("/profiles");
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao atualizar Minha lista.");
      }

      setIsFavorite(!isFavorite);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative group/fav">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          "flex items-center justify-center w-[58px] h-[58px] rounded-xl border-2 transition-all transform hover:scale-105 active:scale-95 shadow-xl backdrop-blur-md",
          isFavorite
            ? "bg-primary border-primary text-white shadow-primary/20"
            : "bg-black/40 border-zinc-500/50 text-white hover:border-white hover:bg-black/60",
          className
        )}
        title={isFavorite ? "Remover da Minha Lista" : "Adicionar à Minha Lista"}
      >
        {loading ? (
          <Loader2 size={24} className="animate-spin" />
        ) : isFavorite ? (
          <Check size={28} />
        ) : (
          <Plus size={28} />
        )}
      </button>

      {error && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[200px] bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl animate-fade-in z-50">
          {error}
        </div>
      )}
    </div>
  );
}
