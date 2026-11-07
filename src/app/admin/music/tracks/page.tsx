"use client";

import Link from "next/link";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Edit3,
  FileText,
  Loader2,
  Music,
  Pause,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import { Autocomplete } from "@/components/admin/music/Autocomplete";
import { MusicAdminNav } from "@/components/admin/music/MusicAdminNav";
import {
  parseID3FromFile,
  resolveAudioUploadMeta,
  uploadWithProgress,
  type ParsedID3,
} from "@/lib/music/id3-client";
import { parseLrc } from "@/lib/music/lrc-parser";

type Artist = { id: string; name: string };

type Album = { id: string; title: string; artistId: string; artist?: Artist };

type Track = {
  id: string;
  title: string;
  durationSec: number;
  streamUrl?: string;
  format: "mp3" | "flac" | "wav" | "aac" | "ogg";
  genres: string[];
  description: string | null;
  artistId: string;
  albumId: string;
  trackNumber: number | null;
  hasLyrics?: boolean;
  status?: "READY" | "PENDING_METADATA" | "ERROR";
  artist: Artist;
  album: Album;
};

export default function AdminMusicTracksPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [items, setItems] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [title, setTitle] = useState("");
  const [durationSec, setDurationSec] = useState("180");
  const [audioUrl, setAudioUrl] = useState("");
  const [format, setFormat] = useState<ParsedID3["format"]>("mp3");
  const [genres, setGenres] = useState("");
  const [description, setDescription] = useState("");
  const [artistId, setArtistId] = useState("");
  const [artistQuery, setArtistQuery] = useState("");
  const [albumId, setAlbumId] = useState("");
  const [albumQuery, setAlbumQuery] = useState("");
  const [trackNumber, setTrackNumber] = useState("");
  const [lyricsLrc, setLyricsLrc] = useState("");
  const [lyricsPlain, setLyricsPlain] = useState("");

  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const albumOptions = useMemo(() => {
    if (!artistId) return albums;
    return albums.filter((a) => a.artistId === artistId);
  }, [albums, artistId]);

  const searchArtists = async (query: string) => {
    const q = query.toLowerCase();
    return artists
      .filter((a) => a.name.toLowerCase().includes(q))
      .map((a) => ({ id: a.id, name: a.name }));
  };

  const searchAlbums = async (query: string) => {
    const q = query.toLowerCase();
    const filtered = artistId
      ? albums.filter((a) => a.artistId === artistId)
      : albums;
    return filtered
      .filter((a) => a.title.toLowerCase().includes(q))
      .map((a) => ({
        id: a.id,
        name: a.title,
        subtitle: a.artist?.name,
      }));
  };

  async function load() {
    setLoading(true);
    setError(null);

    const [artistsResp, albumsResp, tracksResp] = await Promise.all([
      fetch("/api/admin/music/artists", { cache: "no-store" }).catch(
        () => null
      ),
      fetch("/api/admin/music/albums", { cache: "no-store" }).catch(() => null),
      fetch("/api/admin/music/tracks", { cache: "no-store" }).catch(() => null),
    ]);

    if (
      !artistsResp ||
      !artistsResp.ok ||
      !albumsResp ||
      !albumsResp.ok ||
      !tracksResp ||
      !tracksResp.ok
    ) {
      setError("Falha ao carregar dados de faixas");
      setLoading(false);
      return;
    }

    const artistsData = (await artistsResp.json().catch(() => null)) as null | {
      artists?: Artist[];
    };
    const albumsData = (await albumsResp.json().catch(() => null)) as any;
    const tracksData = (await tracksResp.json().catch(() => null)) as any;

    const aList = Array.isArray(artistsData?.artists)
      ? artistsData.artists
      : [];
    const alList = Array.isArray(albumsData?.albums)
      ? (albumsData.albums as Album[])
      : [];
    const tList = Array.isArray(tracksData?.tracks)
      ? (tracksData.tracks as Track[])
      : [];

    setArtists(aList);
    setAlbums(alList);
    setItems(tList);

    const nextArtist = artistId
      ? aList.find((a) => a.id === artistId)
      : aList[0];
    if (!artistId && nextArtist) {
      setArtistId(nextArtist.id);
      setArtistQuery(nextArtist.name);
    }

    if (!albumId) {
      const albumsForArtist = nextArtist
        ? alList.filter((a) => a.artistId === nextArtist.id)
        : alList;
      if (albumsForArtist.length > 0) {
        setAlbumId(albumsForArtist[0].id);
        setAlbumQuery(albumsForArtist[0].title);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (albumOptions.length === 0) {
      setAlbumId("");
      setAlbumQuery("");
      return;
    }
    const exists = albumOptions.some((a) => a.id === albumId);
    if (!exists) {
      setAlbumId(albumOptions[0].id);
      setAlbumQuery(albumOptions[0].title);
    }
  }, [albumOptions, albumId]);

  const handleAudioFileUpload = async (file: File) => {
    if (!artistId || !albumId) {
      setError("Selecione o artista e o álbum antes de enviar o arquivo de áudio");
      return;
    }
    setUploadingAudio(true);
    setUploadProgress(5);
    setError(null);

    try {
      const parsed = await parseID3FromFile(file);
      if (parsed.title && !title) setTitle(parsed.title);
      if (parsed.durationSec > 0) setDurationSec(String(parsed.durationSec));
      if (parsed.format) setFormat(parsed.format);
      if (parsed.trackNumber && !trackNumber) {
        setTrackNumber(String(parsed.trackNumber));
      }
      if (parsed.genres.length > 0 && !genres) {
        setGenres(parsed.genres.join(", "));
      }
      if (parsed.lyricsPlain && !lyricsPlain) {
        setLyricsPlain(parsed.lyricsPlain);
      }

      const meta = resolveAudioUploadMeta(file, parsed.format);
      const presignResp = await fetch("/api/admin/music/upload/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "audio",
          artistId,
          albumId,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar áudio");
    } finally {
      setUploadingAudio(false);
    }
  };

  const togglePlayPreview = (track: Track) => {
    if (!track.streamUrl) return;
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(track.streamUrl);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(track.id);
    void audio.play().catch(() => setPlayingId(null));
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
              <h1 className="text-lg font-bold text-white">Faixas</h1>
              <p className="text-xs text-zinc-400">
                Criar, reproduzir via stream protegido, editar e remover faixas
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
          <div className="text-sm font-bold text-white">Nova faixa</div>
          <Link
            href="/admin/music/upload"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-fuchsia-400 hover:text-fuchsia-300"
          >
            <Upload size={14} />
            Usar upload em lote com ID3 e LRC
          </Link>
        </div>

        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);

            const parsedTrackNo = trackNumber.trim()
              ? Number(trackNumber.trim())
              : null;

            const resp = await fetch("/api/admin/music/tracks", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                title,
                durationSec: Number(durationSec),
                audioUrl,
                format,
                genres,
                description: description || null,
                artistId,
                albumId,
                trackNumber: parsedTrackNo,
                lyricsLrc: lyricsLrc || null,
                lyricsPlain: lyricsPlain || null,
              }),
            }).catch(() => null);

            if (!resp || !resp.ok) {
              const data = (await resp?.json().catch(() => null)) as any;
              setError(`Falha ao criar faixa${data?.error ? ` (${data.error})` : ""}`);
              return;
            }

            setTitle("");
            setDurationSec("180");
            setAudioUrl("");
            setGenres("");
            setDescription("");
            setTrackNumber("");
            setLyricsLrc("");
            setLyricsPlain("");
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
              placeholder="Nome da música"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Artista
            </label>
            <div className="mt-2">
              <Autocomplete
                value={artistQuery}
                onChange={(value) => {
                  setArtistQuery(value);
                  const found = artists.find(
                    (a) => a.name.toLowerCase() === value.toLowerCase()
                  );
                  if (found) {
                    setArtistId(found.id);
                    setAlbumId("");
                    setAlbumQuery("");
                  }
                }}
                onSelect={(option) => {
                  setArtistId(option.id);
                  setArtistQuery(option.name);
                  setAlbumId("");
                  setAlbumQuery("");
                }}
                placeholder="Buscar artista..."
                fetchOptions={searchArtists}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Álbum
            </label>
            <div className="mt-2">
              <Autocomplete
                value={albumQuery}
                onChange={(value) => {
                  setAlbumQuery(value);
                  const found = albumOptions.find(
                    (a) => a.title.toLowerCase() === value.toLowerCase()
                  );
                  if (found) {
                    setAlbumId(found.id);
                  }
                }}
                onSelect={(option) => {
                  setAlbumId(option.id);
                  setAlbumQuery(option.name);
                }}
                placeholder={
                  artistId
                    ? "Buscar álbum..."
                    : "Selecione um artista primeiro..."
                }
                fetchOptions={searchAlbums}
                disabled={!artistId}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Duração (segundos)
            </label>
            <input
              value={durationSec}
              onChange={(e) => setDurationSec(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
              placeholder="180"
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
              Chave de Áudio Wasabi (music/...)
            </label>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <input
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500 font-mono"
                placeholder="music/<artistId>/<albumId>/<trackId>.mp3"
              />
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-3 text-xs font-bold text-fuchsia-300 hover:bg-fuchsia-500/20">
                {uploadingAudio ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                <span>{uploadingAudio ? `${uploadProgress}%` : "Enviar Áudio"}</span>
                <input
                  type="file"
                  accept=".mp3,.flac,.wav,.aac,.m4a,.ogg,.opus"
                  className="hidden"
                  disabled={uploadingAudio}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAudioFileUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {uploadingAudio && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
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
              placeholder="Eletrônica, Synthwave"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Número da Faixa
            </label>
            <input
              value={trackNumber}
              onChange={(e) => setTrackNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500"
              placeholder="1"
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
              placeholder="Descrição curta"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Letra Sincronizada (.lrc opcional)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-fuchsia-400 hover:text-fuchsia-300">
                <FileText size={13} />
                <span>Importar arquivo .lrc</span>
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
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-white font-mono outline-none focus:border-fuchsia-500"
              placeholder="[00:12.00] Primeira linha da letra..."
            />
          </div>

          {error && (
            <div className="md:col-span-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-fuchsia-500/20 hover:opacity-95"
            >
              Criar Faixa
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="text-sm font-bold text-white">
            Faixas Cadastradas ({items.length})
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {loading && (
            <div className="px-6 py-8 text-sm text-zinc-400 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-fuchsia-400" />
              Carregando faixas...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-6 py-8 text-sm text-zinc-500">
              Nenhuma faixa cadastrada.
            </div>
          )}

          {items.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors"
            >
              {t.streamUrl && (
                <button
                  type="button"
                  onClick={() => togglePlayPreview(t)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20"
                  title="Ouvir faixa via streamUrl"
                >
                  {playingId === t.id ? <Pause size={14} /> : <Play size={14} />}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t.trackNumber !== null && (
                    <span className="font-mono text-xs text-zinc-500">
                      #{t.trackNumber}
                    </span>
                  )}
                  <span className="truncate text-sm font-bold text-white">
                    {t.title}
                  </span>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-mono uppercase text-zinc-300">
                    {t.format}
                  </span>
                  {t.hasLyrics && (
                    <span className="rounded-md bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300">
                      LETRA
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-zinc-400">
                  {t.artist?.name ?? ""} · {t.album?.title ?? ""}
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Link
                  href={`/admin/music/tracks/${t.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-white/20 hover:text-white"
                >
                  <Edit3 size={13} />
                  Editar
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
                  onClick={async () => {
                    if (!confirm("Remover faixa?")) return;
                    await fetch(`/api/admin/music/tracks/${t.id}`, {
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
