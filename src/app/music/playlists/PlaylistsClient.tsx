"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Loader2, Lock, Music, Plus, Search, Users } from "lucide-react";
import { CoverImage } from "@/components/music/CoverImage";

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isCollaborative: boolean;
  coverUrl: string | null;
  owner?: { name?: string | null };
  _count?: { tracks: number };
};

export function PlaylistsClient() {
  const [query, setQuery] = useState("");
  const [showPublic, setShowPublic] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(showPublic ? "/api/music/playlists?public=true" : "/api/music/playlists")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Falha ao carregar playlists");
        return data;
      })
      .then((data) => { if (!cancelled) setPlaylists(data.playlists || []); })
      .catch((err: Error) => { if (!cancelled) { setError(err.message); setPlaylists([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showPublic]);

  const filtered = playlists.filter((playlist) => playlist.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Playlists</h1>
          <p className="text-sm text-zinc-400">As suas e as públicas.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowPublic((value) => !value)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${showPublic ? "bg-fuchsia-500 text-white" : "bg-white/5 text-zinc-300"}`}>
            {showPublic ? <Globe size={14} /> : <Lock size={14} />}
            {showPublic ? "Públicas" : "Minhas"}
          </button>
          <Link href="/music/playlists/new" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
            <Plus size={14} /> Nova
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar playlists" className="w-full rounded-xl border border-white/10 bg-zinc-950 py-3 pl-10 pr-3 text-sm outline-none focus:border-fuchsia-500" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-zinc-500" /></div>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Music className="mx-auto mb-3 text-zinc-600" />
          <p className="font-semibold">{query ? "Nenhuma playlist encontrada" : "Nenhuma playlist ainda"}</p>
          {!query && (
            <Link href="/music/playlists/new" className="mt-4 inline-flex items-center gap-2 rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-semibold">
              <Plus size={14} /> Criar playlist
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((playlist) => (
            <Link key={playlist.id} href={`/music/playlists/${playlist.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 hover:border-fuchsia-500/50">
              <div className="relative aspect-square bg-zinc-900">
                {playlist.coverUrl ? <CoverImage src={playlist.coverUrl} alt="" className="absolute inset-0" /> : <div className="flex h-full items-center justify-center text-fuchsia-300/50"><Music size={48} /></div>}
                <div className="absolute left-2 top-2 flex gap-1">
                  {!playlist.isPublic && <span className="rounded-full bg-black/70 p-1.5"><Lock size={12} /></span>}
                  {playlist.isCollaborative && <span className="rounded-full bg-black/70 p-1.5"><Users size={12} /></span>}
                </div>
              </div>
              <div className="p-4">
                <h2 className="truncate font-semibold">{playlist.name}</h2>
                {playlist.description && <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{playlist.description}</p>}
                <div className="mt-3 flex justify-between text-xs text-zinc-500">
                  <span>{playlist._count?.tracks ?? 0} músicas</span>
                  <span className="truncate">{playlist.owner?.name || "Playlist"}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
