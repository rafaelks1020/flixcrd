"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import { CoverImage } from "@/components/music/CoverImage";

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isCollaborative: boolean;
  coverUrl: string | null;
  canEdit: boolean;
  owner?: { id: string };
};

export function EditPlaylistClient({ playlistId, userId }: { playlistId: string; userId: string }) {
  const router = useRouter();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/music/playlists/${playlistId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Falha ao carregar playlist");
        return data as Playlist;
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.canEdit) {
          setError("Você não tem permissão para editar esta playlist");
          return;
        }
        setPlaylist(data);
        setName(data.name || "");
        setDescription(data.description || "");
        setIsPublic(Boolean(data.isPublic));
        setIsCollaborative(Boolean(data.isCollaborative));
        setCoverUrl(data.coverUrl || "");
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoadingData(false); });
    return () => { cancelled = true; };
  }, [playlistId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/music/playlists/${playlistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isPublic,
          isCollaborative,
          coverUrl: coverUrl.trim() || null,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error || "Falha ao atualizar");
        return;
      }
      router.push(`/music/playlists/${playlistId}`);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm("Excluir esta playlist? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    try {
      const resp = await fetch(`/api/music/playlists/${playlistId}`, { method: "DELETE" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error || "Falha ao excluir");
        return;
      }
      router.push("/music/playlists");
    } catch {
      setError("Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  if (loadingData) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-fuchsia-400" /></div>;
  if (!playlist) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-red-300">{error || "Playlist indisponível"}</p>
        <button type="button" onClick={() => router.back()} className="text-sm text-zinc-400">Voltar</button>
      </div>
    );
  }

  const isOwner = playlist.owner?.id === userId;

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-black">Editar playlist</h1>
        <p className="text-sm text-zinc-400">Nome, capa e visibilidade.</p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-2xl border border-white/10">
          <CoverImage src={coverUrl} alt="Capa" className="absolute inset-0" />
        </div>
        <label className="flex-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          URL da capa
          <input value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-fuchsia-500" />
        </label>
      </div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Nome
        <input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-fuchsia-500" />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Descrição
        <textarea value={description} maxLength={500} rows={4} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-fuchsia-500" />
      </label>
      <label className="flex items-center justify-between rounded-xl border border-white/10 p-4">
        <span className="font-semibold">Playlist pública</span>
        <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-5 w-5 accent-fuchsia-500" />
      </label>
      <label className="flex items-center justify-between rounded-xl border border-white/10 p-4">
        <span className="font-semibold">Colaborativa</span>
        <input type="checkbox" checked={isCollaborative} onChange={(event) => setIsCollaborative(event.target.checked)} className="h-5 w-5 accent-fuchsia-500" />
      </label>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isOwner ? (
          <button type="button" onClick={() => void remove()} disabled={deleting} className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-4 py-2 text-sm text-red-200">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir
          </button>
        ) : <span />}
        <button type="submit" disabled={loading || !name.trim()} className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500 px-5 py-2 text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
        </button>
      </div>
    </form>
  );
}
