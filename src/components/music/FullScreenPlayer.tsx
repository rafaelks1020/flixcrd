"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, FileText, List, Loader2, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverImage } from "./CoverImage";
import { FavoriteButton } from "./FavoriteButton";
import { usePlayer } from "./PlayerContext";
import { formatClock } from "./player-types";
import { SyncedLyrics } from "./SyncedLyrics";

type ViewMode = "cover" | "lyrics" | "queue";

export function FullScreenPlayer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    current, isPlaying, isLoading, error, clearError, toggle, next, previous,
    currentTime, duration, seek, isShuffling, toggleShuffle, repeatMode, cycleRepeat,
    volume, setVolume, isMuted, toggleMute, queue, queueIndex, playQueue,
  } = usePlayer();
  const [viewMode, setViewMode] = useState<ViewMode>("cover");
  const [fetchedLyrics, setFetchedLyrics] = useState<string | null>(null);
  const [fetchedPlain, setFetchedPlain] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  useEffect(() => {
    if (!current?.id) {
      setFetchedLyrics(null);
      setFetchedPlain(null);
      return;
    }
    if (current.lyricsLrc) {
      setFetchedLyrics(null);
      setFetchedPlain(null);
      return;
    }
    let cancelled = false;
    setLyricsLoading(true);
    fetch(`/api/music/lyrics?trackId=${encodeURIComponent(current.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setFetchedLyrics(data.lyricsLrc || null);
        setFetchedPlain(data.lyricsPlain || null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLyricsLoading(false); });
    return () => { cancelled = true; };
  }, [current?.id, current?.lyricsLrc]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  if (!current && !isOpen) return null;

  const lyrics = current?.lyricsLrc || fetchedLyrics;
  const plain = fetchedPlain;
  const hasLyrics = Boolean(current?.hasLyrics || lyrics || plain);
  const progress = duration > 0 ? (Math.min(currentTime, duration) / duration) * 100 : 0;

  const seekAt = (clientX: number, rect: DOMRect) => {
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seek(percent * (duration || 0));
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[80] flex flex-col overflow-hidden bg-black text-white transition-all duration-500",
        isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <CoverImage src={current?.coverUrl} alt="" className="scale-125 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/75 to-black" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-4 md:p-8">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={onClose} className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-semibold uppercase tracking-widest text-zinc-300">
            <ChevronDown size={18} />
            <span className="hidden md:inline">Minimizar</span>
          </button>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300 md:flex">
            Áudio
          </div>
          <div className="w-11" />
        </div>

        <div className="grid min-h-0 flex-1 items-center gap-6 lg:grid-cols-2">
          <div className="relative flex justify-center">
            <div className="absolute -top-1 right-0 z-20 flex gap-2">
              {(hasLyrics || lyricsLoading) && (
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "lyrics" ? "cover" : "lyrics")}
                  className={cn("flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-semibold uppercase", viewMode === "lyrics" ? "bg-fuchsia-500 text-white" : "bg-white/10 text-zinc-300")}
                >
                  <FileText size={14} /> Letra
                </button>
              )}
              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "queue" ? "cover" : "queue")}
                  className={cn("flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-semibold uppercase", viewMode === "queue" ? "bg-fuchsia-500 text-white" : "bg-white/10 text-zinc-300")}
                >
                  <List size={14} /> Fila ({queue.length})
                </button>
              )}
            </div>

            {viewMode === "queue" ? (
              <div className="flex h-[50vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/60 md:h-[32rem]">
                <div className="border-b border-white/10 px-4 py-3 text-xs uppercase tracking-widest text-zinc-400">Próximas músicas</div>
                <div className="flex-1 space-y-1 overflow-y-auto p-3">
                  {queue.map((track, index) => (
                    <button
                      key={`${track.id}-${index}`}
                      type="button"
                      onClick={() => void playQueue(queue, index)}
                      className={cn("flex w-full items-center gap-3 rounded-xl p-2 text-left", index === queueIndex ? "bg-fuchsia-500/20" : "hover:bg-white/5")}
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                        <CoverImage src={track.coverUrl} alt="" className="absolute inset-0" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate text-sm", index === queueIndex ? "text-fuchsia-300" : "text-white")}>{track.title}</div>
                        <div className="truncate text-xs text-zinc-400">
                          {track.artistName}
                          {track.source === "radio" ? " · Rádio" : ""}
                        </div>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {index < queueIndex ? "Tocou" : index === queueIndex ? "Tocando" : `#${index - queueIndex}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : viewMode === "lyrics" && (lyrics || plain) ? (
              <div className="h-[50vh] w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-black/60 md:h-[32rem]">
                <SyncedLyrics lyricsLrc={lyrics} lyricsPlain={plain} currentTime={currentTime} isPlaying={isPlaying} onSeek={seek} />
              </div>
            ) : viewMode === "lyrics" && lyricsLoading ? (
              <div className="flex h-[50vh] w-full max-w-xl items-center justify-center rounded-2xl border border-white/10 bg-black/60 md:h-[32rem]">
                <div className="text-center text-sm text-zinc-400">
                  <Loader2 size={28} className="mx-auto mb-3 animate-spin text-fuchsia-400" />
                  Buscando letra...
                </div>
              </div>
            ) : (
              <div className={cn("relative h-56 w-56 overflow-hidden rounded-3xl border border-white/10 shadow-2xl sm:h-72 sm:w-72 md:h-96 md:w-96", isPlaying ? "scale-100" : "scale-95 opacity-80")}>
                <CoverImage src={current?.coverUrl} alt={current?.title || ""} className="absolute inset-0" />
              </div>
            )}
          </div>

          <div className="space-y-6 text-center lg:text-left">
            <div>
              <div className="flex items-start justify-center gap-3 lg:justify-start">
                <h2 className="line-clamp-2 text-3xl font-black tracking-tight sm:text-5xl">{current?.title}</h2>
                {current && <FavoriteButton trackId={current.id} size={26} />}
              </div>
              <div className="mt-2 text-base text-zinc-300 sm:text-xl">
                <span>{current?.artistName}</span>
                {current?.albumTitle ? <span className="text-zinc-500"> · {current.albumTitle}</span> : null}
              </div>
            </div>

            <div>
              <div
                className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/10"
                onClick={(event) => seekAt(event.clientX, event.currentTarget.getBoundingClientRect())}
                onTouchStart={(event) => seekAt(event.touches[0].clientX, event.currentTarget.getBoundingClientRect())}
              >
                <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-400" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-medium text-zinc-500">
                <span>{formatClock(currentTime)}</span>
                <span>{formatClock(duration)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 lg:justify-start">
              <button type="button" onClick={toggleShuffle} className={cn("flex h-11 w-11 items-center justify-center", isShuffling ? "text-fuchsia-400" : "text-zinc-500")} aria-label="Aleatório">
                <Shuffle size={20} />
              </button>
              <button type="button" onClick={() => void previous()} className="flex h-12 w-12 items-center justify-center text-white" aria-label="Anterior">
                <SkipBack size={28} fill="currentColor" />
              </button>
              <button type="button" onClick={() => void toggle()} disabled={isLoading} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black disabled:opacity-60 sm:h-20 sm:w-20" aria-label={isPlaying ? "Pausar" : "Tocar"}>
                {isLoading ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
              </button>
              <button type="button" onClick={() => void next()} className="flex h-12 w-12 items-center justify-center text-white" aria-label="Próxima">
                <SkipForward size={28} fill="currentColor" />
              </button>
              <button type="button" onClick={cycleRepeat} className={cn("relative flex h-11 w-11 items-center justify-center", repeatMode !== "off" ? "text-fuchsia-400" : "text-zinc-500")} aria-label="Repetir">
                <Repeat size={20} />
                {repeatMode === "one" && <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-fuchsia-500 text-[8px] font-black">1</span>}
              </button>
            </div>

            {error && (
              <button type="button" onClick={clearError} className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-2 text-sm text-red-200">
                <AlertCircle size={16} /> {error}
              </button>
            )}

            <div className="hidden items-center justify-center gap-3 sm:flex lg:justify-start">
              <button type="button" onClick={toggleMute} className="text-zinc-400" aria-label={isMuted ? "Ativar som" : "Silenciar"}>
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="h-1 w-40 cursor-pointer accent-fuchsia-500"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
