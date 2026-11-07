"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, Loader2, Mic2, Trash2, Edit3, ArrowLeft } from "lucide-react";
import { useAdminList } from "@/hooks/useAdminData";
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

export default function AdminMusicArtistsPage() {
  const { data: items, loading, reload } = useAdminList<Artist>(
    "/api/admin/music/artists",
    "artists"
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const [enrichingForm, setEnrichingForm] = useState(false);
  const [enrichingRowId, setEnrichingRowId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [genres, setGenres] = useState("");
  const [mbid, setMbid] = useState("");
  const [bio, setBio] = useState("");

  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const validateAndPreviewImage = (url: string, type: "picture" | "banner") => {
    const trimmed = url.trim();
    if (!trimmed) {
      if (type === "picture") {
        setPicturePreview(null);
        setPictureError(null);
      } else {
        setBannerPreview(null);
        setBannerError(null);
      }
      return;
    }

    if (trimmed.startsWith("music/covers/")) {
      if (type === "picture") {
        setPictureError(null);
      } else {
        setBannerError(null);
      }
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:") {
        throw new Error("Apenas HTTPS");
      }
    } catch {
      if (type === "picture") {
        setPictureError("Informe uma URL https:// ou chave music/covers/");
        setPicturePreview(null);
      } else {
        setBannerError("Informe uma URL https:// ou chave music/covers/");
        setBannerPreview(null);
      }
      return;
    }

    const img = new globalThis.Image();
    img.onload = () => {
      if (type === "picture") {
        setPicturePreview(trimmed);
        setPictureError(null);
      } else {
        setBannerPreview(trimmed);
        setBannerError(null);
      }
    };
    img.onerror = () => {
      if (type === "picture") {
        setPictureError("Falha ao carregar imagem de preview");
        setPicturePreview(null);
      } else {
        setBannerError("Falha ao carregar imagem de preview");
        setBannerPreview(null);
      }
    };
    img.src = trimmed;
  };

  const handleEnrichForm = async () => {
    if (!name.trim()) {
      setFormError("Informe o nome do artista antes de consultar o MusicBrainz");
      return;
    }
    setEnrichingForm(true);
    setFormError(null);
    setEnrichMsg(null);

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
        setFormError(data?.error || "Artista não encontrado no MusicBrainz");
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
        setPictureError(null);
        if (sourcePic) setPicturePreview(sourcePic);
      } else if (sourcePic && !pictureUrl) {
        setPictureUrl(sourcePic);
        validateAndPreviewImage(sourcePic, "picture");
      }
      setEnrichMsg(
        `Metadados MusicBrainz aplicados${r.mbid ? ` (MBID: ${r.mbid})` : ""}`
      );
    } catch {
      setFormError("Falha ao consultar o MusicBrainz");
    } finally {
      setEnrichingForm(false);
    }
  };

  const handleEnrichRow = async (artist: Artist) => {
    setEnrichingRowId(artist.id);
    setFormError(null);
    setEnrichMsg(null);
    try {
      const resp = await fetch("/api/admin/music/musicbrainz/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "artist",
          name: artist.name,
          importImages: true,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.result) {
        setFormError(data?.error || `Metadados não encontrados para ${artist.name}`);
        return;
      }
      const r = data.result;
      const nextPicture =
        r.imageStorageUris?.picture ||
        toStorageOrHttpsUrl(artist.pictureUrl) ||
        r.imageSourceUrls?.picture;
      const nextGenres =
        Array.isArray(r.genres) && r.genres.length > 0 ? r.genres : artist.genres;

      const updateResp = await fetch(`/api/admin/music/artists/${artist.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: artist.name,
          pictureUrl: nextPicture,
          bannerUrl: artist.bannerUrl ? toStorageOrHttpsUrl(artist.bannerUrl) : null,
          genres: nextGenres,
          bio: artist.bio,
          mbid: r.mbid || artist.mbid || null,
        }),
      });

      if (!updateResp.ok) {
        const err = await updateResp.json().catch(() => null);
        setFormError(err?.error || "Falha ao atualizar artista enriquecido");
        return;
      }

      setEnrichMsg(`Artista "${artist.name}" enriquecido via MusicBrainz`);
      await reload();
    } catch {
      setFormError("Erro ao enriquecer artista");
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
              <Mic2 size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Artistas</h1>
              <p className="text-xs text-zinc-400">
                Criar, editar, enriquecer via MusicBrainz e remover artistas
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
          <div className="text-sm font-bold text-white">Novo artista</div>
          <button
            type="button"
            onClick={handleEnrichForm}
            disabled={enrichingForm}
            className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3.5 py-2 text-xs font-bold text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20 disabled:opacity-50"
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
            setFormError(null);
            setEnrichMsg(null);

            const resp = await fetch("/api/admin/music/artists", {
              method: "POST",
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
              setFormError(
                `Falha ao criar artista${data?.error ? ` (${data.error})` : ""}`
              );
              return;
            }

            setName("");
            setPictureUrl("");
            setBannerUrl("");
            setGenres("");
            setMbid("");
            setBio("");
            setPicturePreview(null);
            setBannerPreview(null);
            setPictureError(null);
            setBannerError(null);

            await reload();
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
              placeholder="Nome do artista"
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
              placeholder="Ex: b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d"
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
                validateAndPreviewImage(e.target.value, "picture");
              }}
              className={`mt-2 w-full rounded-xl border bg-black/50 px-4 py-3 text-sm text-white outline-none transition-colors ${
                pictureError ? "border-red-500" : "border-white/10 focus:border-fuchsia-500"
              }`}
              placeholder="https://..."
            />
            {pictureError && (
              <div className="mt-1 text-xs text-red-400">{pictureError}</div>
            )}
            {picturePreview && (
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Preview
                </div>
                <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-white/10">
                  <img
                    src={picturePreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Banner URL (opcional)
            </label>
            <input
              value={bannerUrl}
              onChange={(e) => {
                setBannerUrl(e.target.value);
                validateAndPreviewImage(e.target.value, "banner");
              }}
              className={`mt-2 w-full rounded-xl border bg-black/50 px-4 py-3 text-sm text-white outline-none transition-colors ${
                bannerError ? "border-red-500" : "border-white/10 focus:border-fuchsia-500"
              }`}
              placeholder="https://..."
            />
            {bannerError && (
              <div className="mt-1 text-xs text-red-400">{bannerError}</div>
            )}
            {bannerPreview && (
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Preview
                </div>
                <div className="relative h-24 w-full overflow-hidden rounded-xl border border-white/10">
                  <img
                    src={bannerPreview}
                    alt="Banner preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Gêneros (separados por vírgula)
            </label>
            <input
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
              placeholder="Rock, Synthwave, Eletrônica"
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
              rows={3}
              placeholder="Descrição do artista"
            />
          </div>

          {formError && (
            <div className="md:col-span-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              {formError}
            </div>
          )}

          {enrichMsg && (
            <div className="md:col-span-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3 text-xs text-fuchsia-300">
              {enrichMsg}
            </div>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-fuchsia-500/20 hover:opacity-95"
            >
              Criar Artista
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="text-sm font-bold text-white">
            Artistas Cadastrados ({items?.length ?? 0})
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {loading && (
            <div className="px-6 py-8 text-sm text-zinc-400 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-fuchsia-400" />
              Carregando artistas...
            </div>
          )}
          {!loading && items && items.length === 0 && (
            <div className="px-6 py-8 text-sm text-zinc-500">
              Nenhum artista cadastrado.
            </div>
          )}

          {items &&
            items.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black">
                  {a.pictureUrl ? (
                    <img
                      src={a.pictureUrl}
                      alt={a.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                      <Mic2 size={18} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">
                      {a.name}
                    </span>
                    {a.mbid && (
                      <span className="rounded-md bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300">
                        MBID
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-zinc-400">
                    {a.genres?.length ? a.genres.join(", ") : "Sem gêneros definidos"}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={enrichingRowId === a.id}
                    onClick={() => handleEnrichRow(a)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-bold text-fuchsia-300 hover:bg-fuchsia-500/20 disabled:opacity-50"
                    title="Enriquecer via MusicBrainz"
                  >
                    {enrichingRowId === a.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    <span className="hidden md:inline">MusicBrainz</span>
                  </button>
                  <Link
                    href={`/admin/music/artists/${a.id}`}
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
                          "Remover artista? Isso remove álbuns e faixas relacionados."
                        )
                      )
                        return;
                      await fetch(`/api/admin/music/artists/${a.id}`, {
                        method: "DELETE",
                      }).catch(() => undefined);
                      await reload();
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
