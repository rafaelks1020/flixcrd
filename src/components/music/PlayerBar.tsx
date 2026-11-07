"use client";

import { useState } from "react";
import { AlertCircle, ChevronUp, Loader2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { CoverImage } from "./CoverImage";
import { FullScreenPlayer } from "./FullScreenPlayer";
import { usePlayer } from "./PlayerContext";

export function PlayerBar() {
  const { current, isPlaying, isLoading, error, clearError, toggle, next, previous, currentTime, duration, seek } = usePlayer();
  const [isFullScreen, setIsFullScreen] = useState(false);
  if (!current) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const seekFromClientX = (clientX: number, width: number, left: number) => {
    const percent = Math.max(0, Math.min(1, (clientX - left) / width));
    seek(percent * duration);
  };

  return (
    <>
      <FullScreenPlayer isOpen={isFullScreen} onClose={() => setIsFullScreen(false)} />
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        {error && (
          <div className="flex items-center justify-between gap-2 border-b border-red-500/30 bg-red-500/15 px-4 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-300" />
              <span className="truncate text-xs text-red-200">{error}</span>
            </div>
            <button type="button" onClick={clearError} className="shrink-0 rounded bg-red-500/20 px-2 py-1 text-xs text-red-100">
              OK
            </button>
          </div>
        )}
        <div
          className="relative h-1 w-full cursor-pointer bg-white/10"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            seekFromClientX(event.clientX, rect.width, rect.left);
          }}
          onTouchStart={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const touch = event.touches[0];
            seekFromClientX(touch.clientX, rect.width, rect.left);
          }}
        >
          <div className="absolute left-0 top-0 h-full bg-fuchsia-500" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          <button type="button" onClick={() => setIsFullScreen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <CoverImage src={current.coverUrl} alt={current.title} className="absolute inset-0" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{current.title}</div>
              <div className="truncate text-xs text-zinc-400">{current.artistName}</div>
            </div>
            <ChevronUp size={20} className="shrink-0 text-zinc-500" />
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => void previous()} className="flex h-10 w-10 items-center justify-center text-zinc-300 active:text-white" aria-label="Faixa anterior">
              <SkipBack size={18} />
            </button>
            <button
              type="button"
              onClick={() => void toggle()}
              disabled={isLoading}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black disabled:opacity-50"
              aria-label={isPlaying ? "Pausar" : "Tocar"}
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button type="button" onClick={() => void next()} className="flex h-10 w-10 items-center justify-center text-zinc-300 active:text-white" aria-label="Próxima faixa">
              <SkipForward size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
