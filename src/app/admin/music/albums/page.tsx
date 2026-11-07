"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Disc3, Edit3, Loader2, Sparkles, Trash2 } from "lucide-react";
import { MusicAdminNav } from "@/components/admin/music/MusicAdminNav";
import { toStorageOrHttpsUrl } from "@/lib/music/id3-client";

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
  artist: Artist;
};

export default function AdminMusicAlbumsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [items, setItems] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [enrichingForm, setEnrichingForm] = useState(false);
  const [enrichingRowId, setEnrichingRowId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [coverUrl, setCoverUrl] = useState("");
  const [backdropUrl, setBackdropUrl] = useState("");
  const [tags, setTags] = useState("");
  const [genres, setGenres] = useState("");
  const [label, setLabel] = useState("");
  const [mbid, setMbid] = useState("");
  const [description, setDescription] = useState("");
  const [artistId, setArtistId] = useState("");

  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [backdropPreview, setBackdropPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [backdropError, setBackdropError] = useState<string | null>(null);

  const validateAndPreviewImage = (url: string, type: "cover" | "backdrop") => {
    const trimmed = url.trim();
    if (!trimmed) {
      if (type === "cover") {
        setCoverPreview(null);
        setCoverError(null);
      } else {
        setBackdropPreview(null);
        setBackdropError(null);
      }
      return;
    }

    if (trimmed.startsWith("music/covers/")) {
      if (type === "cover") {
        setCoverError(null);
      } else {
        setBackdropError(null);
      }
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:") throw new Error("Apenas HTTPS");
    } catch {
      if (type === "cover") {
        setCoverError("Informe uma URL https:// ou chave music/covers/");
        setCoverPreview(null);
      } else {
        setBackdropError("Informe uma URL https:// ou chave music/covers/");
        setBackdropPreview(null);
      }
      return;
    }

    const img = new globalThis.Image();
    img.onload = () => {
      if (type === "cover") {
        setCoverPreview(trimmed);
        setCoverError(null);
      } else {
        setBackdropPreview(trimmed);
        setBackdropError(null);
      }
    };
    img.onerror = () => {
      if (type === "cover") {
        setCoverError("Falha ao carregar preview da capa");
        setCoverPreview(null);
      } else {
        setBackdropError("Falha ao carregar preview do backdrop");
        setBackdropPreview(null);
      }
    };
    img.src = trimmed;
  };

  async function load() {
    setLoading(true);
    setError(null);

    const [artistsResp, albumsResp] = await Promise.all([
      fetch("/api/admin/music/artists", { cache: "no-store" }).catch(() => null),
      fetch("/api/admin/music/albums", { cache: "no-store" }).catch(() => null),
    ]);

    if (!artistsResp || !artistsResp.ok || !albumsResp || !albumsResp.ok) {
      setError("Falha ao carregar artistas e álbuns");
      setLoading(false);
      return;
    }

    const artistsData = (await artistsResp.json().catch(() => null)) as null | {
      artists?: Artist[];
    };
    const albumsData = (await albumsResp.json().catch(() => null)) as null | {
      albums?: Album[];
    };

    const aList = Array.isArray(artistsData?.artists) ? artistsData.artists : [];
    const alList = Array.isArray(albumsData?.albums) ? albumsData.albums : [];

    setArtists(aList);
    setItems(alList);

    if (!artistId && aList.length > 0) setArtistId(aList[0].id);

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const handleEnrichForm = async () => {
    if (!title.trim()) {
      setError("Informe o título do álbum antes de consultar o MusicBrainz");
      return;
    }
    setEnrichingForm(true);
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
        setError(data?.error || "Álbum não encontrado no MusicBrainz");
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
        setCoverError(null);
        if (sourceCover) setCoverPreview(sourceCover);
      } else if (sourceCover && !coverUrl) {
        setCoverUrl(sourceCover);
        validateAndPreviewImage(sourceCover, "cover");
      }
      setInfoMsg(
        `Metadados MusicBrainz aplicados${r.mbid ? ` (MBID: ${r.mbid})` : ""}`
      );
    } catch {
      setError("Falha ao consultar o MusicBrainz");
    } finally {
      setEnrichingForm(false);
    }
  };

  const handleEnrichRow = async (album: Album) => {
    setEnrichingRowId(album.id);
    setError(null);
    setInfoMsg(null);

    try {
      const resp = await fetch("/api/admin/music/musicbrainz/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "album",
          title: album.title,
          artistName: album.artist?.name || undefined,
          importImages: true,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.result) {
        setError(data?.error || `Metadados não encontrados para ${album.title}`);
        return;
      }
      const r = data.result;
      const nextCover =
        r.imageStorageUris?.cover ||
        toStorageOrHttpsUrl(album.coverUrl) ||
        r.imageSourceUrls?.cover;
      const nextGenres =
        Array.isArray(r.genres) && r.genres.length > 0 ? r.genres : album.genres;
      const nextTags =
        Array.isArray(r.tags) && r.tags.length > 0 ? r.tags : album.tags;

      const updateResp = await fetch(`/api/admin/music/albums/${album.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: album.title,
          artistId: album.artistId,
          year: album.year,
          coverUrl: nextCover,
          backdropUrl: album.backdropUrl ? toStorageOrHttpsUrl(album.backdropUrl) : null,
          genres: nextGenres,
          tags: nextTags,
          label: album.label,
          description: album.description,
          mbid: r.mbid || album.mbid || null,
        }),
      });

      if (!updateResp.ok) {
        const err = await updateResp.json().catch(() => null);
        setError(err?.error || "Falha ao salvar álbum enriquecido");
        return;
      }

      setInfoMsg(`Álbum "${album.title}" enriquecido via MusicBrainz`);
      await load();
    } catch {
      setError("Erro ao enriquecer álbum");
    } finally {
      setEnrichingRowId(null);
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
              <h1 className="text-lg font-bold text-white">Álbuns</h1>
              <p className="text-xs text-zinc-400">
                Criar, editar, enriquecer via MusicBrainz e remover álbuns
              </p>
            </div>
          </div>
          <Link
            href="/admin/music"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={14} />
            Voltar ao Painel
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-white">Novo álbum</div>
          <button
            type="button"
            onClick={handleEnrichForm}
            disabled={enrichingForm}
            className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3.5 py-2 text-xs font-bold text-fuchsia-300 hover:bg-fuchsia-500/20 disabled:opacity-50"
          >
            {enrichingForm ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Enriquecer via MusicBrainz
          </button>
        </div>

        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setInfoMsg(null);

            const resp = await fetch("/api/admin/music/albums", {
              method: "POST",
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
              setError(`Falha ao criar álbum${data?.error ? ` (${data.error})` : ""}`);
              return;
            }

            setTitle("");
            setCoverUrl("");
            setBackdropUrl("");
            setTags("");
            setGenres("");
            setLabel("");
            setMbid("");
            setDescription("");
            setCoverPreview(null);
            setBackdropPreview(null);
            setCoverError(null);
            setBackdropError(null);

            await load();
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
              placeholder="Nome do álbum"
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
              placeholder="2025"
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
                validateAndPreviewImage(e.target.value, "cover");
              }}
              className={`mt-2 w-full rounded-xl border bg-black/50 px-4 py-3 text-sm text-white outline-none transition-colors ${
                coverError ? "border-red-500" : "border-white/10 focus:border-fuchsia-500"
              }`}
              placeholder="https://..."
            />
            {coverError && (
              <div className="mt-1 text-xs text-red-400">{coverError}</div>
            )}
            {coverPreview && (
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Preview
                </div>
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-white/10">
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Backdrop URL (opcional)
            </label>
            <input
              value={backdropUrl}
              onChange={(e) => {
                setBackdropUrl(e.target.value);
                validateAndPreviewImage(e.target.value, "backdrop");
              }}
              className={`mt-2 w-full rounded-xl border bg-black/50 px-4 py-3 text-sm text-white outline-none transition-colors ${
                backdropError
                  ? "border-red-500"
                  : "border-white/10 focus:border-fuchsia-500"
              }`}
              placeholder="https://..."
            />
            {backdropError && (
              <div className="mt-1 text-xs text-red-400">{backdropError}</div>
            )}
            {backdropPreview && (
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Preview
                </div>
                <div className="relative h-24 w-full overflow-hidden rounded-xl border border-white/10">
                  <img
                    src={backdropPreview}
                    alt="Backdrop preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Tags (separadas por vírgula)
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
              placeholder="Destaque, Clássico"
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
              placeholder="Synthwave, Eletrônica"
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
              placeholder="Gravadora"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              MusicBrainz ID (MBID opcional)
            </label>
            <input
              value={mbid}
              onChange={(e) => setMbid(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500 font-mono"
              placeholder="Release Group MBID"
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
              placeholder="Descrição curta do álbum"
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

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-fuchsia-500/20 hover:opacity-95"
            >
              Criar Álbum
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="text-sm font-bold text-white">
            Álbuns Cadastrados ({items.length})
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {loading && (
            <div className="px-6 py-8 text-sm text-zinc-400 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-fuchsia-400" />
              Carregando álbuns...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-6 py-8 text-sm text-zinc-500">
              Nenhum álbum cadastrado.
            </div>
          )}

          {items.map((al) => (
            <div
              key={al.id}
              className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
                {al.coverUrl ? (
                  <img
                    src={al.coverUrl}
                    alt={al.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-600">
                    <Disc3 size={18} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-white">
                    {al.title}
                  </span>
                  {al.mbid && (
                    <span className="rounded-md bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300">
                      MBID
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-zinc-400">
                  {al.artist?.name ?? ""} · {al.year}
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={enrichingRowId === al.id}
                  onClick={() => handleEnrichRow(al)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-bold text-fuchsia-300 hover:bg-fuchsia-500/20 disabled:opacity-50"
                  title="Enriquecer via MusicBrainz"
                >
                  {enrichingRowId === al.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  <span className="hidden md:inline">MusicBrainz</span>
                </button>
                <Link
                  href={`/admin/music/albums/${al.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-white/20 hover:text-white"
                >
                  <Edit3 size={13} />
                  Editar
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
                  onClick={async () => {
                    if (
                      !confirm(
                        "Remover álbum? Isso remove as faixas relacionadas."
                      )
                    )
                      return;
                    await fetch(`/api/admin/music/albums/${al.id}`, {
                      method: "DELETE",
                    }).catch(() => undefined);
                    await load();
                  }}
                >
                  <Trash2 size={13} />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
