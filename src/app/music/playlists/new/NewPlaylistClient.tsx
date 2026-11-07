"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { CoverImage } from "@/components/music/CoverImage";

export function NewPlaylistClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/music/playlists", {
        method: "POST",
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
        setError(data.error || "Falha ao criar playlist");
        return;
      }
      router.push(data.playlist?.id ? `/music/playlists/${data.playlist.id}` : "/music/playlists");
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-black">Nova playlist</h1>
        <p className="text-sm text-zinc-400">Organize as faixas do catálogo.</p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-2xl border border-dashed border-white/15">
          <CoverImage src={coverUrl.startsWith("https://") ? coverUrl : null} alt="Capa" className="absolute inset-0" />
        </div>
        <label className="flex-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          URL da capa
          <input value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} placeholder="https://exemplo.com/capa.jpg" className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-fuchsia-500" />
        </label>
      </div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-fuchsia-500" />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Descrição
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-fuchsia-500" />
      </label>
      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950 p-4">
        <span><span className="block font-semibold">Playlist pública</span><span className="text-sm text-zinc-400">Outras pessoas com acesso à música podem ver.</span></span>
        <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-5 w-5 accent-fuchsia-500" />
      </label>
      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950 p-4">
        <span><span className="block font-semibold">Colaborativa</span><span className="text-sm text-zinc-400">Editores podem incluir faixas.</span></span>
        <input type="checkbox" checked={isCollaborative} onChange={(event) => setIsCollaborative(event.target.checked)} className="h-5 w-5 accent-fuchsia-500" />
      </label>
      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/music/playlists")} className="rounded-full px-5 py-2 text-sm text-zinc-300">Cancelar</button>
        <button type="submit" disabled={loading || !name.trim()} className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500 px-5 py-2 text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Criar playlist
        </button>
      </div>
    </form>
  );
}
