"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Mic2, Sparkles, Trash2 } from "lucide-react";
import { MusicAdminNav } from "@/components/admin/music/MusicAdminNav";
import { toStorageOrHttpsUrl } from "@/lib/music/id3-client";

type Artist = {
  id: string;
  name: string;
  pictureUrl: string;
  bannerUrl: string | null;
  genres: string[];
  bio: string | null;
  mbid?: string | null;
};

export default function AdminMusicArtistEditPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const router = useRouter();
  const [artistId, setArtistId] = useState<string>("");
  const [item, setItem] = useState<Artist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const [name, setName] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [genres, setGenres] = useState("");
  const [mbid, setMbid] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      const resolved = await params;
      if (cancelled) return;
      setArtistId(resolved.artistId);

      const resp = await fetch(`/api/admin/music/artists/${resolved.artistId}`, {
        cache: "no-store",
      }).catch(() => null);
      if (!resp || !resp.ok) {
        if (!cancelled) setError("Artista não encontrado");
        return;
      }
      const data = (await resp.json().catch(() => null)) as null | {
        artist?: Artist;
      };
      if (cancelled) return;
      if (!data?.artist) {
        setError("Artista não encontrado");
        return;
      }
      const a = data.artist;
      setItem(a);
      setName(a.name);
      setPictureUrl(toStorageOrHttpsUrl(a.pictureUrl));
      setPicturePreview(a.pictureUrl);
      setBannerUrl(a.bannerUrl ? toStorageOrHttpsUrl(a.bannerUrl) : "");
      setGenres((a.genres ?? []).join(", "));
      setMbid(a.mbid ?? "");
      setBio(a.bio ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const handleEnrich = async () => {
    if (!name.trim()) {
      setError("Informe o nome do artista para consultar o MusicBrainz");
      return;
    }
    setEnriching(true);
    setError(null);
    setInfoMsg(null);

    try {
      const resp = await fetch("/api/admin/music/musicbrainz/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "artist",
          name: name.trim(),
          importImages: true,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.result) {
        setError(data?.error || "Metadados não encontrados no MusicBrainz");
        return;
      }
      const r = data.result;
      if (r.mbid) setMbid(r.mbid);
      if (Array.isArray(r.genres) && r.genres.length > 0) {
        setGenres(r.genres.join(", "));
      }
      const storagePic = r.imageStorageUris?.picture;
      const sourcePic = r.imageSourceUrls?.picture;
      if (storagePic) {
        setPictureUrl(storagePic);
        if (sourcePic) setPicturePreview(sourcePic);
      } else if (sourcePic) {
        setPictureUrl(sourcePic);
        setPicturePreview(sourcePic);
      }
      setInfoMsg(
        `Metadados do MusicBrainz carregados${r.mbid ? ` (MBID: ${r.mbid})` : ""}. Clique em Salvar para confirmar.`
      );
    } catch {
      setError("Falha ao consultar o MusicBrainz");
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <MusicAdminNav />

      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-400">
              <Mic2 size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Editar Artista</h1>
              <p className="text-xs text-zinc-400">{item?.name ?? "Carregando..."}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleEnrich}
              disabled={enriching || !artistId}
              className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3.5 py-2 text-xs font-bold text-fuchsia-300 hover:bg-fuchsia-500/20 disabled:opacity-50"
            >
              {enriching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              Enriquecer via MusicBrainz
            </button>
            <Link
              href="/admin/music/artists"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white"
            >
              <ArrowLeft size={14} />
              Voltar
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!artistId) return;
            setSaving(true);
            setError(null);
            setInfoMsg(null);

            const resp = await fetch(`/api/admin/music/artists/${artistId}`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name,
                pictureUrl: toStorageOrHttpsUrl(pictureUrl),
                bannerUrl: bannerUrl ? toStorageOrHttpsUrl(bannerUrl) : null,
                genres,
                mbid: mbid || null,
                bio: bio || null,
              }),
            }).catch(() => null);

            if (!resp || !resp.ok) {
              const data = (await resp?.json().catch(() => null)) as any;
              setError(`Falha ao salvar${data?.error ? ` (${data.error})` : ""}`);
              setSaving(false);
              return;
            }

            const data = (await resp.json().catch(() => null)) as null | {
              artist?: Artist;
            };
            if (data?.artist) {
              setItem(data.artist);
              setPicturePreview(data.artist.pictureUrl);
              setPictureUrl(toStorageOrHttpsUrl(data.artist.pictureUrl));
            }
            setInfoMsg("Alterações salvas com sucesso.");
            setSaving(false);
          }}
        >
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Nome
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              MusicBrainz ID (MBID)
            </label>
            <input
              value={mbid}
              onChange={(e) => setMbid(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Foto URL (https:// ou music/covers/...)
            </label>
            <input
              value={pictureUrl}
              onChange={(e) => {
                setPictureUrl(e.target.value);
                if (e.target.value.startsWith("https://")) {
                  setPicturePreview(e.target.value);
                }
              }}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
            {picturePreview && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={picturePreview}
                  alt={name}
                  className="h-16 w-16 rounded-xl border border-white/10 object-cover"
                />
                <span className="text-xs text-zinc-500 truncate">
                  {pictureUrl.startsWith("music/covers/")
                    ? `Wasabi: ${pictureUrl}`
                    : "Imagem externa"}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Banner URL
            </label>
            <input
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Gêneros (separados por vírgula)
            </label>
            <input
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Biografia
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
              rows={4}
            />
          </div>

          {error && (
            <div className="md:col-span-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {infoMsg && (
            <div className="md:col-span-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3 text-xs text-fuchsia-300">
              {infoMsg}
            </div>
          )}

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || !artistId}
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-fuchsia-500/20 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              disabled={!artistId}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300 hover:bg-red-500/20"
              onClick={async () => {
                if (
                  !confirm(
                    "Remover artista? Isso remove álbuns e faixas relacionados."
                  )
                )
                  return;
                await fetch(`/api/admin/music/artists/${artistId}`, {
                  method: "DELETE",
                }).catch(() => undefined);
                router.push("/admin/music/artists");
              }}
            >
              <Trash2 size={14} />
              Excluir
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
