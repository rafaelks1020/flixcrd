"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Play } from "lucide-react";
import { CoverImage } from "./CoverImage";
import { PlayButton } from "./PlayButton";

type HistoryTrack = {
  id: string;
  title: string;
  artistName: string;
  albumId: string;
  coverUrl: string;
};

export function ContinueListening() {
  const [tracks, setTracks] = useState<HistoryTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/music/history?limit=8")
      .then((res) => res.json())
      .then((data) => {
        const items = (data.history || []).map((entry: { track: HistoryTrack }) => ({
          id: entry.track.id,
          title: entry.track.title,
          artistName: entry.track.artistName,
          albumId: entry.track.albumId,
          coverUrl: entry.track.coverUrl,
        }));
        setTracks(items);
      })
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || tracks.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-fuchsia-400" />
          <h2 className="text-lg font-bold text-white sm:text-xl">Continue ouvindo</h2>
        </div>
        <Link href="/music/library" className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white">
          Ver tudo <ChevronRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-4">
        {tracks.slice(0, 8).map((track) => (
          <div key={track.id} className="group flex items-center gap-3 rounded-xl bg-zinc-900/80 p-2 ring-1 ring-white/5">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <CoverImage src={track.coverUrl} alt={track.title} className="absolute inset-0" />
            </div>
            <PlayButton trackId={track.id} albumId={track.albumId} source="history" className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-semibold text-white group-hover:text-fuchsia-200">{track.title}</div>
              <div className="flex items-center gap-1 truncate text-xs text-zinc-400">
                <Play size={12} className="shrink-0" />
                {track.artistName}
              </div>
            </PlayButton>
          </div>
        ))}
      </div>
    </section>
  );
}
