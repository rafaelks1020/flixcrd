"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadPlayContext } from "./play-context";
import { usePlayer } from "./PlayerContext";
import type { PlayerTrackSource } from "./player-types";

export function PlayButton({
  trackId,
  source = "album",
  className,
  children,
  label = "Tocar",
}: {
  trackId: string;
  albumId?: string;
  source?: PlayerTrackSource;
  className?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const { playQueue } = usePlayer();

  const handlePlay = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const context = await loadPlayContext(trackId, source);
    if (!context) return;
    void playQueue(context.tracks, context.startIndex);
  };

  return (
    <button type="button" className={cn(className)} onClick={(event) => void handlePlay(event)} aria-label={label}>
      {children ?? (
        <span className="inline-flex items-center gap-2">
          <Play size={16} fill="currentColor" />
          {label}
        </span>
      )}
    </button>
  );
}
