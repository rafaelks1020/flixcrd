"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Globe, Loader2, Lock, Play, Plus, Search, Trash2, Users } from "lucide-react";
import { CoverImage } from "@/components/music/CoverImage";
import { usePlayer } from "@/components/music/PlayerContext";
import { formatClock, toPlayerTrack, type PlayerTrack } from "@/components/music/player-types";

type TrackRow = {
  id: string;
  title: string;
  durationSec: number;
  streamUrl?: string | null;
  artist?: { name?: string | null };
  album?: { id?: string; title?: string; coverUrl?: string | null };
};

type Item = { id: string; track: TrackRow };
type Playlist = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isCollaborative: boolean;
  coverUrl: string | null;
  canEdit: boolean;
  owner?: { name?: string | null };
  tracks: Item[];
};
type SearchTrack = {
  id: string;
  title: string;
  artistName?: string;
  albumTitle?: string;
  coverUrl?: string | null;
};

function asQueue(playlist: Playlist): PlayerTrack[] {
  return playlist.tracks
    .map((item) => toPlayerTrack({
      id: item.track.id,
      title: item.track.title,
      artistName: item.track.artist?.name || "Artista",
      albumTitle: item.track.album?.title || "",
      albumId: item.track.album?.id,
      coverUrl: item.track.album?.coverUrl || playlist.coverUrl,
      streamUrl: item.track.streamUrl,
    }, "playlist"))
    .filter((track): track is PlayerTrack => track !== null);
}

export function PlaylistClient({ playlistId }: { playlistId: string }) {
  const router = useRouter();
  const { playQueue } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchTrack[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/music/playlists/${playlistId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Playlist não encontrada");
        return data as Playlist;
      })
      .then((data) => { if (!cancelled) setPlaylist(data); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playlistId, refreshKey]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/music/catalog/search?q=${encodeURIComponent(search.trim())}`)
        .then((res) => res.json())
        .then((data) => setResults(Array.isArray(data.tracks) ? data.tracks : []))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const playFrom = (startIndex = 0) => {
    if (!playlist) return;
    const queue = asQueue(playlist);
    if (queue.length === 0) {
      setError("Nenhuma faixa com áudio nesta playlist");
      return;
    }
    void playQueue(queue, Math.min(startIndex, queue.length - 1));
  };

  const addSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      for (const trackId of selected) {
        const resp = await fetch(`/api/music/playlists/${playlistId}/tracks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          setError(data.error || "Falha ao adicionar faixa");
        }
      }
      setShowAdd(false);
      setSearch("");
      setResults([]);
      setSelected(new Set());
      setRefreshKey((value) => value + 1);
    } finally {
      setBusy(false);
    }
  };

  const removeTrack = async (trackId: string) => {
    if (!confirm("Remover esta música da playlist?")) return;
    const resp = await fetch(`/api/music/playlists/${playlistId}/tracks?trackId=${encodeURIComponent(trackId)}`, { method: "DELETE" });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setError(data.error || "Falha ao remover");
      return;
    }
    setRefreshKey((value) => value + 1);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-500" /></div>;
  if (!playlist) return <p className="text-sm text-red-300">{error || "Playlist não encontrada"}</p>;

  const total = playlist.tracks.reduce((sum, item) => sum + (item.track.durationSec || 0), 0);
  const queue = asQueue(playlist);

  return (
    <div className="space-y-8">
      <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft size={16} /> Voltar
      </button>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="relative h-52 w-52 shrink-0 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10">
          {playlist.coverUrl ? <CoverImage src={playlist.coverUrl} alt="" className="absolute inset-0" /> : <div className="flex h-full items-center justify-center text-5xl font-black text-fuchsia-300/40">{playlist.name.charAt(0).toUpperCase()}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-black sm:text-5xl">{playlist.name}</h1>
            {playlist.canEdit && (
              <Link href={`/music/playlists/${playlist.id}/edit`} className="rounded-full border border-white/10 p-2 text-zinc-300 hover:text-white" aria-label="Editar playlist">
                <Edit size={18} />
              </Link>
            )}
          </div>
          {playlist.description && <p className="mt-2 text-sm text-zinc-400">{playlist.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span>{playlist.owner?.name || "Playlist"}</span>
            <span>·</span>
            <span>{playlist.tracks.length} músicas</span>
            <span>·</span>
            <span>{formatClock(total)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            {playlist.isPublic ? <Globe size={14} /> : <Lock size={14} />}
            {playlist.isCollaborative && <Users size={14} />}
            <span>{playlist.isPublic ? "Pública" : "Privada"}{playlist.isCollaborative ? " · colaborativa" : ""}</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => playFrom(0)} disabled={queue.length === 0} className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500 px-6 py-3 text-sm font-semibold disabled:opacity-40">
              <Play size={16} fill="currentColor" /> Tocar playlist
            </button>
            {playlist.canEdit && (
              <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold">
                <Plus size={16} /> Adicionar músicas
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        {playlist.tracks.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-zinc-500">Nenhuma música nesta playlist.</p>
        ) : (
          playlist.tracks.map((item, index) => {
            const playableIndex = queue.findIndex((track) => track.id === item.track.id);
            return (
              <div key={item.id} className="flex items-center gap-3 border-b border-white/5 px-3 py-3 last:border-0 sm:px-4">
                <button type="button" onClick={() => playableIndex >= 0 && playFrom(playableIndex)} className="w-6 text-center text-sm text-zinc-500 hover:text-fuchsia-300" aria-label={`Tocar ${item.track.title}`}>
                  {index + 1}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{item.track.title}</div>
                  <div className="truncate text-sm text-zinc-400">{item.track.artist?.name || "Artista"} · {item.track.album?.title || "Álbum"}</div>
                </div>
                <div className="text-xs text-zinc-500">{formatClock(item.track.durationSec || 0)}</div>
                <button type="button" onClick={() => playableIndex >= 0 && playFrom(playableIndex)} className="text-zinc-400 hover:text-white" aria-label="Tocar" disabled={playableIndex < 0}>
                  <Play size={16} />
                </button>
                {playlist.canEdit && (
                  <button type="button" onClick={() => void removeTrack(item.track.id)} className="text-red-300" aria-label="Remover">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="font-semibold">Adicionar músicas</h2>
              <button type="button" onClick={() => setShowAdd(false)} className="text-zinc-400">Fechar</button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no catálogo" className="w-full rounded-xl border border-white/10 bg-black py-3 pl-10 pr-3 text-sm outline-none focus:border-fuchsia-500" />
              </div>
              {selected.size > 0 && (
                <button type="button" onClick={() => void addSelected()} disabled={busy} className="w-full rounded-xl bg-fuchsia-500 py-2 text-sm font-semibold disabled:opacity-50">
                  {busy ? "Adicionando..." : `Adicionar ${selected.size}`}
                </button>
              )}
              {results.map((track) => {
                const on = selected.has(track.id);
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(track.id)) next.delete(track.id);
                      else next.add(track.id);
                      return next;
                    })}
                    className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${on ? "bg-fuchsia-500/20 ring-1 ring-fuchsia-500" : "hover:bg-white/5"}`}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                      <CoverImage src={track.coverUrl} alt="" className="absolute inset-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{track.title}</div>
                      <div className="truncate text-xs text-zinc-400">{track.artistName} · {track.albumTitle}</div>
                    </div>
                  </button>
                );
              })}
              {search.trim().length >= 2 && results.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">Nenhuma música encontrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
