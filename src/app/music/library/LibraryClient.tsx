"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Heart, Loader2, Music, Play } from "lucide-react";
import { CoverImage } from "@/components/music/CoverImage";
import { FavoriteButton } from "@/components/music/FavoriteButton";
import { PlayButton } from "@/components/music/PlayButton";
import { formatClock } from "@/components/music/player-types";

type TrackItem = {
  id: string;
  title: string;
  artistName: string;
  albumId: string;
  albumTitle: string;
  coverUrl: string;
  durationSec: number;
};

type FavoriteItem = { id: string; addedAt: string; track: TrackItem };
type HistoryItem = { id: string; playedAt: string; track: TrackItem };

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins} min atrás`;
  if (hours < 24) return `${hours} h atrás`;
  if (days < 7) return `${days} d atrás`;
  return date.toLocaleDateString("pt-BR");
}

export function LibraryClient() {
  const [tab, setTab] = useState<"favorites" | "history">("favorites");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = tab === "favorites" ? "/api/music/favorites" : "/api/music/history?limit=50";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (tab === "favorites") setFavorites(data.favorites || []);
        else setHistory(data.history || []);
      })
      .catch(() => {
        if (cancelled) return;
        if (tab === "favorites") setFavorites([]);
        else setHistory([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  const items = tab === "favorites" ? favorites : history;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600">
          {tab === "favorites" ? <Heart size={24} fill="currentColor" /> : <Clock size={24} />}
        </div>
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">{tab === "favorites" ? "Músicas curtidas" : "Tocadas recentemente"}</h1>
          <p className="text-sm text-zinc-400">{items.length} {items.length === 1 ? "música" : "músicas"}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("favorites")} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${tab === "favorites" ? "bg-fuchsia-500 text-white" : "bg-white/5 text-zinc-300"}`}>
          <Heart size={14} fill={tab === "favorites" ? "currentColor" : "none"} /> Curtidas
        </button>
        <button type="button" onClick={() => setTab("history")} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${tab === "history" ? "bg-fuchsia-500 text-white" : "bg-white/5 text-zinc-300"}`}>
          <Clock size={14} /> Histórico
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-500" /></div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <Music size={48} className="mx-auto mb-3 text-zinc-600" />
          <p className="font-semibold text-zinc-300">{tab === "favorites" ? "Nenhuma música curtida" : "Nenhuma música tocada"}</p>
          <Link href="/music/search" className="mt-4 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">Explorar</Link>
        </div>
      ) : (
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-white/10">
          {items.map((item, index) => {
            const track = item.track;
            const when = "addedAt" in item ? item.addedAt : item.playedAt;
            return (
              <div key={item.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <div className="w-6 text-center text-xs text-zinc-500">{index + 1}</div>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <CoverImage src={track.coverUrl} alt="" className="absolute inset-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{track.title}</div>
                  <div className="truncate text-xs text-zinc-400">{track.artistName} · {track.albumTitle}</div>
                </div>
                <div className="hidden text-xs text-zinc-500 sm:block">{formatDate(when)}</div>
                <div className="text-xs text-zinc-500">{formatClock(track.durationSec)}</div>
                <PlayButton trackId={track.id} albumId={track.albumId} source={tab === "history" ? "history" : "search"} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">
                  <Play size={14} fill="currentColor" />
                </PlayButton>
                <FavoriteButton trackId={track.id} size={16} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
