"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Music,
  Trash2,
  Upload,
} from "lucide-react";
import { MusicAdminNav } from "@/components/admin/music/MusicAdminNav";
import {
  parseID3FromFile,
  resolveAudioUploadMeta,
  uploadWithProgress,
  type ParsedID3,
} from "@/lib/music/id3-client";
import { parseLrc } from "@/lib/music/lrc-parser";

type Artist = { id: string; name: string };

type Album = { id: string; title: string; artistId: string };

type Track = {
  id: string;
  title: string;
  durationSec: number;
  streamUrl?: string;
  format: ParsedID3["format"];
  genres: string[];
  description: string | null;
  artistId: string;
  albumId: string;
  trackNumber: number | null;
  discNumber?: number | null;
  mbid?: string | null;
  status?: "READY" | "PENDING_METADATA" | "ERROR";
  statusNote?: string | null;
  lyricsLrc?: string | null;
  lyricsPlain?: string | null;
};

export default function AdminMusicTrackEditPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const router = useRouter();
  const [trackId, setTrackId] = useState<string>("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [item, setItem] = useState<Track | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [title, setTitle] = useState("");
  const [durationSec, setDurationSec] = useState("180");
  const [audioUrl, setAudioUrl] = useState("");
  const [format, setFormat] = useState<ParsedID3["format"]>("mp3");
  const [genres, setGenres] = useState("");
  const [description, setDescription] = useState("");
  const [artistId, setArtistId] = useState("");
  const [albumId, setAlbumId] = useState("");
  const [trackNumber, setTrackNumber] = useState("");
  const [discNumber, setDiscNumber] = useState("");
  const [mbid, setMbid] = useState("");
  const [status, setStatus] = useState<"READY" | "PENDING_METADATA" | "ERROR">(
    "READY"
  );
  const [statusNote, setStatusNote] = useState("");
  const [lyricsLrc, setLyricsLrc] = useState("");
  const [lyricsPlain, setLyricsPlain] = useState("");

  const albumOptions = useMemo(() => {
    if (!artistId) return albums;
    return albums.filter((a) => a.artistId === artistId);
  }, [albums, artistId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      const resolved = await params;
      if (cancelled) return;
      setTrackId(resolved.trackId);

      const [artistsResp, albumsResp, trackResp] = await Promise.all([
        fetch("/api/admin/music/artists", { cache: "no-store" }).catch(
          () => null
        ),
        fetch("/api/admin/music/albums", { cache: "no-store" }).catch(
          () => null
        ),
        fetch(`/api/admin/music/tracks/${resolved.trackId}`, {
          cache: "no-store",
        }).catch(() => null),
      ]);

      if (
        !artistsResp ||
        !artistsResp.ok ||
        !albumsResp ||
        !albumsResp.ok ||
        !trackResp ||
        !trackResp.ok
      ) {
        if (!cancelled) setError("Falha ao carregar dados da faixa");
        return;
      }

      const artistsData = (await artistsResp.json().catch(() => null)) as any;
      const albumsData = (await albumsResp.json().catch(() => null)) as any;
      const trackData = (await trackResp.json().catch(() => null)) as any;

      const aList = Array.isArray(artistsData?.artists)
        ? (artistsData.artists as Artist[])
        : [];
      const alList = Array.isArray(albumsData?.albums)
        ? (albumsData.albums as Album[])
        : [];
      const t = (trackData?.track ?? null) as Track | null;

      if (cancelled) return;

      setArtists(aList);
      setAlbums(alList);

      if (!t) {
        setError("Faixa não encontrada");
        return;
      }

      setItem(t);
      setTitle(t.title);
      setDurationSec(String(t.durationSec));
      setFormat(t.format);
      setGenres((t.genres ?? []).join(", "));
      setDescription(t.description ?? "");
      setArtistId(t.artistId);
      setAlbumId(t.albumId);
      setTrackNumber(
        t.trackNumber === null || t.trackNumber === undefined
          ? ""
          : String(t.trackNumber)
      );
      setDiscNumber(
        t.discNumber === null || t.discNumber === undefined
          ? ""
          : String(t.discNumber)
      );
      setMbid(t.mbid ?? "");
      setStatus(t.status ?? "READY");
      setStatusNote(t.statusNote ?? "");
      setLyricsLrc(t.lyricsLrc ?? "");
      setLyricsPlain(t.lyricsPlain ?? "");
    })();

    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!albumId) return;
    const exists = albumOptions.some((a) => a.id === albumId);
    if (!exists && albumOptions.length > 0) setAlbumId(albumOptions[0].id);
  }, [albumOptions, albumId]);

  const handleReplaceAudio = async (file: File) => {
    if (!artistId || !albumId || !trackId) return;
    setUploadingAudio(true);
    setUploadProgress(5);
    setError(null);
    setInfoMsg(null);

    try {
      const parsed = await parseID3FromFile(file);
      if (parsed.durationSec > 0) setDurationSec(String(parsed.durationSec));
      if (parsed.format) setFormat(parsed.format);

      const meta = resolveAudioUploadMeta(file, parsed.format);
      const presignResp = await fetch("/api/admin/music/upload/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "audio",
          artistId,
          albumId,
          trackId,
          filename: meta.filename,
          contentType: meta.contentType,
        }),
      });
      const presignData = await presignResp.json().catch(() => null);
      if (!presignResp.ok || !presignData?.url || !presignData?.key) {
        throw new Error(presignData?.error || "Falha ao obter URL de upload");
      }

      await uploadWithProgress(
        presignData.url,
        file,
        meta.contentType,
        (pct) => setUploadProgress(pct)
      );

      setAudioUrl(presignData.key);
      setInfoMsg("Novo áudio enviado ao storage. Clique em Salvar para confirmar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar áudio");
    } finally {
      setUploadingAudio(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <MusicAdminNav />

      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-400">
              <Music size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Editar Faixa</h1>
              <p className="text-xs text-zinc-400">{item?.title ?? "Carregando..."}</p>
            </div>
          </div>
          <Link
            href="/admin/music/tracks"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={14} />
            Voltar
          </Link>
        </div>

        {item?.streamUrl && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Reprodução via Stream Seguro ({item.streamUrl})
            </div>
            <audio
              controls
              preload="none"
              src={item.streamUrl}
              className="h-9 w-full"
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!trackId) return;
            setSaving(true);
            setError(null);
            setInfoMsg(null);

            const parsedTrackNo = trackNumber.trim()
              ? Number(trackNumber.trim())
              : null;
            const parsedDiscNo = discNumber.trim()
              ? Number(discNumber.trim())
              : null;

            const payload: Record<string, unknown> = {
              title,
              durationSec: Number(durationSec),
              format,
              genres,
              description: description || null,
              artistId,
              albumId,
              trackNumber: parsedTrackNo,
              discNumber: parsedDiscNo,
              mbid: mbid || null,
              status,
              statusNote: statusNote || null,
              lyricsLrc: lyricsLrc || null,
              lyricsPlain: lyricsPlain || null,
            };

            if (audioUrl.trim()) {
              payload.audioUrl = audioUrl.trim();
            }

            const resp = await fetch(`/api/admin/music/tracks/${trackId}`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            }).catch(() => null);

            if (!resp || !resp.ok) {
              const data = (await resp?.json().catch(() => null)) as any;
              setError(`Falha ao salvar${data?.error ? ` (${data.error})` : ""}`);
              setSaving(false);
              return;
            }

            const data = (await resp.json().catch(() => null)) as any;
            if (data?.track) setItem(data.track as Track);
            setInfoMsg("Faixa atualizada com sucesso.");
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
              Álbum
            </label>
            <select
              value={albumId}
              onChange={(e) => setAlbumId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            >
              {albumOptions.map((a) => (
                <option key={a.id} value={a.id} className="bg-zinc-900">
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Duração (segundos)
            </label>
            <input
              value={durationSec}
              onChange={(e) => setDurationSec(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Formato
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ParsedID3["format"])}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            >
              <option value="mp3" className="bg-zinc-900">
                mp3
              </option>
              <option value="flac" className="bg-zinc-900">
                flac
              </option>
              <option value="wav" className="bg-zinc-900">
                wav
              </option>
              <option value="aac" className="bg-zinc-900">
                aac
              </option>
              <option value="ogg" className="bg-zinc-900">
                ogg
              </option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Substituir Áudio no storage (opcional, deixe em branco para manter o atual)
            </label>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <input
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="Mantendo chave atual (ou informe nova chave music/...)"
                className="flex-1 rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500 font-mono"
              />
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-3 text-xs font-bold text-fuchsia-300 hover:bg-fuchsia-500/20">
                {uploadingAudio ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                <span>
                  {uploadingAudio ? `${uploadProgress}%` : "Enviar Novo Áudio"}
                </span>
                <input
                  type="file"
                  accept=".mp3,.flac,.wav,.aac,.m4a,.ogg,.opus"
                  className="hidden"
                  disabled={uploadingAudio}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleReplaceAudio(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Número da Faixa
            </label>
            <input
              value={trackNumber}
              onChange={(e) => setTrackNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Número do Disco
            </label>
            <input
              value={discNumber}
              onChange={(e) => setDiscNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Status
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value as "READY" | "PENDING_METADATA" | "ERROR"
                )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            >
              <option value="READY" className="bg-zinc-900">
                READY
              </option>
              <option value="PENDING_METADATA" className="bg-zinc-900">
                PENDING_METADATA
              </option>
              <option value="ERROR" className="bg-zinc-900">
                ERROR
              </option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              MusicBrainz Recording ID (MBID)
            </label>
            <input
              value={mbid}
              onChange={(e) => setMbid(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500 font-mono"
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

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Descrição
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Observação de Status
            </label>
            <input
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Letra Sincronizada (.lrc)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-fuchsia-400 hover:text-fuchsia-300">
                <FileText size={13} />
                <span>Carregar arquivo .lrc</span>
                <input
                  type="file"
                  accept=".lrc"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const content = await file.text();
                      const parsed = parseLrc(content);
                      setLyricsLrc(content);
                      if (parsed.plainText) setLyricsPlain(parsed.plainText);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <textarea
              value={lyricsLrc}
              onChange={(e) => setLyricsLrc(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-white font-mono outline-none focus:border-fuchsia-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Letra em Texto Puro
            </label>
            <textarea
              value={lyricsPlain}
              onChange={(e) => setLyricsPlain(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-white outline-none focus:border-fuchsia-500"
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
              disabled={saving || !trackId}
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-fuchsia-500/20 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              disabled={!trackId}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300 hover:bg-red-500/20"
              onClick={async () => {
                if (!confirm("Remover faixa?")) return;
                await fetch(`/api/admin/music/tracks/${trackId}`, {
                  method: "DELETE",
                }).catch(() => undefined);
                router.push("/admin/music/tracks");
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
