"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Play, Sparkles } from "lucide-react";
import { CoverImage } from "./CoverImage";
import { PlayButton } from "./PlayButton";

type RecommendedTrack = {
  id: string;
  title: string;
  artistName: string;
  albumId: string;
  coverUrl: string;
};

export function Recommendations() {
  const [tracks, setTracks] = useState<RecommendedTrack[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/music/recommendations?limit=8")
      .then((res) => res.json())
      .then((data) => {
        setTracks(data.recommendations || []);
        setGenres(Array.isArray(data.basedOn?.genres) ? data.basedOn.genres : []);
      })
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || tracks.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles size={18} className="shrink-0 text-violet-300" />
          <h2 className="truncate text-lg font-bold text-white sm:text-xl">Feito para você</h2>
          {genres.length > 0 && (
            <span className="hidden truncate text-xs text-zinc-500 sm:inline">
              baseado em {genres.slice(0, 2).join(", ")}
            </span>
          )}
        </div>
        <Link href="/music/search" className="flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white">
          Explorar <ChevronRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-4">
        {tracks.slice(0, 8).map((track) => (
          <PlayButton
            key={track.id}
            trackId={track.id}
            albumId={track.albumId}
            source="recommendation"
            className="group flex items-center gap-3 rounded-xl bg-zinc-900/80 p-2 text-left ring-1 ring-white/5"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <CoverImage src={track.coverUrl} alt={track.title} className="absolute inset-0" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white group-hover:text-fuchsia-200">{track.title}</div>
              <div className="flex items-center gap-1 truncate text-xs text-zinc-400">
                <Play size={12} className="shrink-0" />
                {track.artistName}
              </div>
            </div>
          </PlayButton>
        ))}
      </div>
    </section>
  );
}
