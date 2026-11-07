"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { usePlayer } from "./PlayerContext";
import { toPlayerTrack, type PlayerTrack, type RawPlayable } from "./player-types";

export function PlayRadioButton() {
  const { playQueue } = usePlayer();
  const [loading, setLoading] = useState(false);

  const play = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/music/radio?limit=20");
      if (!resp.ok) return;
      const data = (await resp.json()) as { tracks?: RawPlayable[] };
      const tracks = (data.tracks || [])
        .map((track) => toPlayerTrack(track, "radio"))
        .filter((track): track is PlayerTrack => track !== null);
      if (tracks.length > 0) await playQueue(tracks, 0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void play()}
      disabled={loading}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black disabled:opacity-60"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
      Ouvir
    </button>
  );
}
