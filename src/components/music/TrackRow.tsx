"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadPlayContext } from "./play-context";
import { usePlayer } from "./PlayerContext";
import { formatClock } from "./player-types";

export function TrackRow({
  trackId,
  trackNumber,
  title,
  artistName,
  duration,
}: {
  trackId: string;
  trackNumber: number;
  title: string;
  artistName: string;
  duration?: number;
}) {
  const { playQueue, current, isPlaying, toggle } = usePlayer();
  const isCurrent = current?.id === trackId;

  const handleClick = async () => {
    if (isCurrent) {
      await toggle();
      return;
    }
    const context = await loadPlayContext(trackId, "album");
    if (!context) return;
    void playQueue(context.tracks, context.startIndex);
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/[0.04] sm:gap-5 sm:px-4",
        isCurrent && "bg-white/[0.05]",
      )}
    >
      <div className="relative w-6 text-center">
        <span className={cn("text-xs font-semibold", isCurrent ? "text-fuchsia-400" : "text-zinc-500 group-hover:opacity-0")}>
          {String(trackNumber).padStart(2, "0")}
        </span>
        <span className={cn("absolute inset-0 flex items-center justify-center", isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          {isCurrent && isPlaying ? (
            <span className="flex h-3 items-end gap-0.5">
              <span className="w-0.5 animate-pulse rounded-full bg-fuchsia-400" style={{ height: "60%" }} />
              <span className="w-0.5 animate-pulse rounded-full bg-fuchsia-400" style={{ height: "100%" }} />
              <span className="w-0.5 animate-pulse rounded-full bg-fuchsia-400" style={{ height: "40%" }} />
            </span>
          ) : (
            <Play size={14} className="text-fuchsia-400" fill="currentColor" />
          )}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-sm font-semibold sm:text-base", isCurrent ? "text-fuchsia-300" : "text-white")}>{title}</div>
        <div className="truncate text-[11px] uppercase tracking-widest text-zinc-500">{artistName}</div>
      </div>
      <div className="text-xs tabular-nums text-zinc-500">{formatClock(duration || 0)}</div>
    </button>
  );
}
