"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Disc3, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { MusicAdminNav } from "@/components/admin/music/MusicAdminNav";
import {
  resolveCoverUploadMeta,
  toStorageOrHttpsUrl,
  uploadWithProgress,
} from "@/lib/music/id3-client";

type Artist = { id: string; name: string };

type Album = {
  id: string;
  title: string;
  year: number;
  coverUrl: string;
  backdropUrl: string | null;
  tags: string[];
  genres: string[];
  label: string | null;
  description: string | null;
  mbid?: string | null;
  artistId: string;
};

export default function AdminMusicAlbumEditPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const router = useRouter();
  const [albumId, setAlbumId] = useState<string>("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [item, setItem] = useState<Album | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);

  const [title, setTitle] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [backdropUrl, setBackdropUrl] = useState("");
  const [tags, setTags] = useState("");
  const [genres, setGenres] = useState("");
  const [label, setLabel] = useState("");
  const [mbid, setMbid] = useState("");
  const [description, setDescription] = useState("");
  const [artistId, setArtistId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      const resolved = await params;
      if (cancelled) return;
      setAlbumId(resolved.albumId);

      const [artistsResp, albumResp] = await Promise.all([
        fetch("/api/admin/music/artists", { cache: "no-store" }).catch(
          () => null
        ),
        fetch(`/api/admin/music/albums/${resolved.albumId}`, {
          cache: "no-store",
        }).catch(() => null),
      ]);

      if (!artistsResp || !artistsResp.ok || !albumResp || !albumResp.ok) {
        if (!cancelled) setError("Falha ao carregar dados do álbum");
        return;
      }

      const artistsData = (await artistsResp.json().catch(() => null)) as null | {
        artists?: Artist[];
      };
      const albumData = (await albumResp.json().catch(() => null)) as null | {
        album?: Album;
      };

      if (cancelled) return;

      const aList = Array.isArray(artistsData?.artists) ? artistsData.artists : [];
      setArtists(aList);

      if (!albumData?.album) {
        setError("Álbum não encontrado");
        return;
      }

      const al = albumData.album;
      setItem(al);
      setTitle(al.title);
      setYear(String(al.year));
      setCoverUrl(toStorageOrHttpsUrl(al.coverUrl));
      setCoverPreview(al.coverUrl);
      setBackdropUrl(al.backdropUrl ? toStorageOrHttpsUrl(al.backdropUrl) : "");
      setTags((al.tags ?? []).join(", "));
      setGenres((al.genres ?? []).join(", "));
      setLabel(al.label ?? "");
      setMbid(al.mbid ?? "");
      setDescription(al.description ?? "");
      setArtistId(al.artistId);
    })();

    return () => {
      cancelled = true;
    };
  }, [params]);

  const handleCoverFileUpload = async (file: File) => {
    if (!albumId || !artistId) {
      setError("Álbum e artista são obrigatórios para enviar a capa");
      return;
    }
    setCoverUploading(true);
    setCoverProgress(5);
    setError(null);
    setInfoMsg(null);

    try {
      const meta = resolveCoverUploadMeta(file.type, file.name);
      const presignResp = await fetch("/api/admin/music/upload/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "cover",
          artistId,
          albumId,
          filename: meta.filename,
          contentType: meta.contentType,
        }),
      });
      const presignData = await presignResp.json().catch(() => null);
      if (!presignResp.ok || !presignData?.url || !presignData?.key) {
        throw new Error(presignData?.error || "Falha ao obter URL presignada da capa");
      }

      await uploadWithProgress(
        presignData.url,
        file,
        meta.contentType,
        (pct) => setCoverProgress(pct)
      );

      setCoverUrl(presignData.key);
      setCoverPreview(URL.createObjectURL(file));
      setInfoMsg("Capa enviada ao Wasabi. Clique em Salvar para gravar no álbum.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar capa");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleEnrich = async () => {
    if (!title.trim()) {
      setError("Informe o título do álbum para consultar o MusicBrainz");
      return;
    }
    setEnriching(true);
    setError(null);
    setInfoMsg(null);

    const selectedArtistName = artists.find((a) => a.id === artistId)?.name || "";

    try {
      const resp = await fetch("/api/admin/music/musicbrainz/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "album",
          title: title.trim(),
          artistName: selectedArtistName || undefined,
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
      if (Array.isArray(r.tags) && r.tags.length > 0) {
        setTags(r.tags.join(", "));
      }
      const storageCover = r.imageStorageUris?.cover;
      const sourceCover = r.imageSourceUrls?.cover;
      if (storageCover) {
        setCoverUrl(storageCover);
        if (sourceCover) setCoverPreview(sourceCover);
      } else if (sourceCover) {
        setCoverUrl(sourceCover);
        setCoverPreview(sourceCover);
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
              <Disc3 size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Editar Álbum</h1>
              <p className="text-xs text-zinc-400">{item?.title ?? "Carregando..."}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleEnrich}
              disabled={enriching || !albumId}
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
              href="/admin/music/albums"
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
            if (!albumId) return;
            setSaving(true);
            setError(null);
            setInfoMsg(null);

            const resp = await fetch(`/api/admin/music/albums/${albumId}`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                title,
                year: Number(year),
                coverUrl: toStorageOrHttpsUrl(coverUrl),
                backdropUrl: backdropUrl ? toStorageOrHttpsUrl(backdropUrl) : null,
                tags,
                genres,
                label: label || null,
                mbid: mbid || null,
                description: description || null,
                artistId,
              }),
            }).catch(() => null);

            if (!resp || !resp.ok) {
              const data = (await resp?.json().catch(() => null)) as any;
              setError(`Falha ao salvar${data?.error ? ` (${data.error})` : ""}`);
              setSaving(false);
              return;
            }

            const data = (await resp.json().catch(() => null)) as null | {
              album?: Album;
            };
            if (data?.album) {
              setItem(data.album);
              setCoverPreview(data.album.coverUrl);
              setCoverUrl(toStorageOrHttpsUrl(data.album.coverUrl));
            }
            setInfoMsg("Álbum atualizado com sucesso.");
            setSaving(false);
          }}
        >
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Título
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Artista
            </label>
            <select
              value={artistId}
              onChange={(e) => setArtistId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            >
              {artists.map((a) => (
                <option key={a.id} value={a.id} className="bg-zinc-900">
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Ano
            </label>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Capa URL (https:// ou music/covers/...)
            </label>
            <input
              value={coverUrl}
              onChange={(e) => {
                setCoverUrl(e.target.value);
                if (e.target.value.startsWith("https://")) {
                  setCoverPreview(e.target.value);
                }
              }}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-fuchsia-500/40 hover:text-white">
                <Upload size={13} className="text-fuchsia-400" />
                <span>{coverUploading ? "Enviando capa..." : "Enviar arquivo de capa"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={coverUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleCoverFileUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {coverUploading && (
                <div className="flex items-center gap-2 text-xs text-fuchsia-300">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-fuchsia-500 transition-all"
                      style={{ width: `${coverProgress}%` }}
                    />
                  </div>
                  <span>{coverProgress}%</span>
                </div>
              )}
            </div>
            {coverPreview && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={coverPreview}
                  alt={title}
                  className="h-16 w-16 rounded-xl border border-white/10 object-cover"
                />
                <span className="text-xs text-zinc-500 truncate">
                  {coverUrl.startsWith("music/covers/")
                    ? `Wasabi: ${coverUrl}`
                    : "Imagem externa"}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Backdrop URL
            </label>
            <input
              value={backdropUrl}
              onChange={(e) => setBackdropUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Tags (separadas por vírgula)
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Gêneros (separados por vírgula)
            </label>
            <input
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Gravadora (Label)
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
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

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Descrição
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
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
              disabled={saving || !albumId}
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-fuchsia-500/20 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              disabled={!albumId}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300 hover:bg-red-500/20"
              onClick={async () => {
                if (
                  !confirm(
                    "Remover álbum? Isso remove as faixas relacionadas."
                  )
                )
                  return;
                await fetch(`/api/admin/music/albums/${albumId}`, {
                  method: "DELETE",
                }).catch(() => undefined);
                router.push("/admin/music/albums");
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
