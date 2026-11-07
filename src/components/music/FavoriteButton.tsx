"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  trackId,
  size = 20,
  className,
  showText = false,
}: {
  trackId: string;
  size?: number;
  className?: string;
  showText?: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/music/favorites?trackId=${encodeURIComponent(trackId)}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setIsFavorite(Boolean(data.isFavorite)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [trackId]);

  const toggle = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (isFavorite) {
        await fetch(`/api/music/favorites?trackId=${encodeURIComponent(trackId)}`, { method: "DELETE" });
        setIsFavorite(false);
      } else {
        await fetch("/api/music/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId }),
        });
        setIsFavorite(true);
      }
    } catch {
      // Mantém o estado anterior se a rede falhar.
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        void toggle();
      }}
      disabled={isLoading}
      className={cn("flex items-center gap-1.5 disabled:opacity-50", isFavorite ? "text-fuchsia-400" : "text-zinc-400 hover:text-white", className)}
      title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <Heart size={size} fill={isFavorite ? "currentColor" : "none"} className={isLoading ? "animate-pulse" : undefined} />
      {showText && <span className="text-xs font-semibold">{isFavorite ? "Curtido" : "Curtir"}</span>}
    </button>
  );
}
