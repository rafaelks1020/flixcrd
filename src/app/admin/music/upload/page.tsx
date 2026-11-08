"use client";

import Link from "next/link";
import { useCallback, useState, useRef, useMemo } from "react";
import {
  parseID3FromFile,
  resolveAudioUploadMeta,
  resolveCoverUploadMeta,
  uploadWithProgress,
  type ParsedID3,
} from "@/lib/music/id3-client";
import { parseLrc, getBaseFilename, type ParsedLrc } from "@/lib/music/lrc-parser";
import { MusicAdminNav } from "@/components/admin/music/MusicAdminNav";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Disc3,
  Eye,
  EyeOff,
  FileAudio,
  FileText,
  FolderOpen,
  Loader2,
  Music,
  Upload,
  X,
} from "lucide-react";

type UploadStatus =
  | "pending"
  | "parsing"
  | "uploading"
  | "creating"
  | "done"
  | "error";

type LrcFile = {
  file: File;
  content: string;
  parsed: ParsedLrc;
};

type UploadItem = {
  id: string;
  file: File;
  relativePath: string;
  parsed: ParsedID3 | null;
  lrc: LrcFile | null;
  status: UploadStatus;
  error: string | null;
  progress: number;
  createdTrackId: string | null;
};

type AlbumGroup = {
  artistName: string;
  albumName: string;
  year: number | null;
  coverData: Uint8Array | null;
  coverMimeType: string | null;
  tracks: UploadItem[];
};

function groupByAlbum(items: UploadItem[]): AlbumGroup[] {
  const groups = new Map<string, AlbumGroup>();

  for (const item of items) {
    if (!item.parsed) continue;

    const artistName = item.parsed.artist || "Artista Desconhecido";
    const albumName = item.parsed.album || "Álbum Desconhecido";
    const key = `${artistName.toLowerCase()}|||${albumName.toLowerCase()}`;

    if (!groups.has(key)) {
      groups.set(key, {
        artistName,
        albumName,
        year: item.parsed.year,
        coverData: item.parsed.coverData,
        coverMimeType: item.parsed.coverMimeType,
        tracks: [],
      });
    }

    const group = groups.get(key)!;
    group.tracks.push(item);

    if (!group.coverData && item.parsed.coverData) {
      group.coverData = item.parsed.coverData;
      group.coverMimeType = item.parsed.coverMimeType;
    }

    if (!group.year && item.parsed.year) {
      group.year = item.parsed.year;
    }
  }

  for (const group of groups.values()) {
    group.tracks.sort((a, b) => {
      const numA = a.parsed?.trackNumber ?? 999;
      const numB = b.parsed?.trackNumber ?? 999;
      return numA - numB;
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const artistCmp = a.artistName.localeCompare(b.artistName);
    if (artistCmp !== 0) return artistCmp;
    return a.albumName.localeCompare(b.albumName);
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatBitrate(kbps: number | null): string {
  if (!kbps) return "-";
  return `${kbps} kbps`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function AdminMusicUploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const isAudioFile = (filename: string) => {
    const ext = filename.toLowerCase();
    return (
      ext.endsWith(".mp3") ||
      ext.endsWith(".flac") ||
      ext.endsWith(".wav") ||
      ext.endsWith(".m4a") ||
      ext.endsWith(".aac") ||
      ext.endsWith(".ogg") ||
      ext.endsWith(".opus")
    );
  };

  const isLrcFile = (filename: string) => {
    return filename.toLowerCase().endsWith(".lrc");
  };

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const audioFiles: { file: File; relativePath: string }[] = [];
    const lrcFiles: { file: File; relativePath: string }[] = [];

    for (const file of files) {
      const relativePath = (file as any).webkitRelativePath || file.name;

      if (isAudioFile(file.name)) {
        audioFiles.push({ file, relativePath });
      } else if (isLrcFile(file.name)) {
        lrcFiles.push({ file, relativePath });
      }
    }

    if (audioFiles.length === 0 && lrcFiles.length > 0) {
      // Parear LRC com faixas ja carregadas na fila pelo nome base
      const lrcMap = new Map<string, LrcFile>();
      for (const { file } of lrcFiles) {
        try {
          const content = await file.text();
          const parsed = parseLrc(content);
          lrcMap.set(getBaseFilename(file.name), { file, content, parsed });
        } catch {
          // ignora falha de leitura de LRC
        }
      }
      setItems((prev) =>
        prev.map((item) => {
          const matched = lrcMap.get(getBaseFilename(item.file.name));
          return matched ? { ...item, lrc: matched } : item;
        })
      );
      return;
    }

    if (audioFiles.length === 0) {
      setGlobalError(
        "Nenhum arquivo de áudio encontrado. Formatos aceitos: MP3, FLAC, WAV, AAC, M4A, OGG, OPUS"
      );
      return;
    }

    setGlobalError(null);
    setIsParsing(true);

    const lrcMap = new Map<string, LrcFile>();
    for (const { file } of lrcFiles) {
      try {
        const content = await file.text();
        const parsed = parseLrc(content);
        const baseName = getBaseFilename(file.name);
        lrcMap.set(baseName, { file, content, parsed });
      } catch {
        // Ignora erros de leitura de LRC
      }
    }

    const newItems: UploadItem[] = audioFiles.map(({ file, relativePath }) => {
      const baseName = getBaseFilename(file.name);
      const lrc = lrcMap.get(baseName) || null;

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        relativePath,
        parsed: null,
        lrc,
        status: "parsing" as const,
        error: null,
        progress: 0,
        createdTrackId: null,
      };
    });

    setItems((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const parsed = await parseID3FromFile(item.file);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  parsed,
                  status: "pending",
                  error: parsed.isValid
                    ? null
                    : parsed.validationErrors.join(", "),
                }
              : i
          )
        );
      } catch {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: "Falha ao ler metadados ID3" }
              : i
          )
        );
      }
    }

    setIsParsing(false);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const removeGroup = useCallback((artistName: string, albumName: string) => {
    const key = `${artistName.toLowerCase()}|||${albumName.toLowerCase()}`;
    setItems((prev) =>
      prev.filter((i) => {
        if (!i.parsed) return true;
        const itemArtist = (i.parsed.artist || "Artista Desconhecido").toLowerCase();
        const itemAlbum = (i.parsed.album || "Álbum Desconhecido").toLowerCase();
        return `${itemArtist}|||${itemAlbum}` !== key;
      })
    );
  }, []);

  const toggleGroup = useCallback((artistName: string, albumName: string) => {
    const key = `${artistName}|||${albumName}`;
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const PARALLEL_UPLOADS = 4;

  const processAll = useCallback(async () => {
    setIsProcessing(true);
    setGlobalError(null);

    const toProcess = items.filter((i) => i.status === "pending" && i.parsed);
    if (toProcess.length === 0) {
      setIsProcessing(false);
      return;
    }

    // Carregar artistas e albuns existentes para obter IDs exigidos pelo presign
    const artistsByName = new Map<string, string>();
    const albumsByKey = new Map<string, string>();

    try {
      const [artistsResp, albumsResp] = await Promise.all([
        fetch("/api/admin/music/artists?limit=500", { cache: "no-store" }),
        fetch("/api/admin/music/albums?limit=500", { cache: "no-store" }),
      ]);
      if (artistsResp.ok) {
        const data = await artistsResp.json().catch(() => null);
        for (const a of data?.artists ?? []) {
          if (a?.id && a?.name) {
            artistsByName.set(String(a.name).trim().toLowerCase(), String(a.id));
          }
        }
      }
      if (albumsResp.ok) {
        const data = await albumsResp.json().catch(() => null);
        for (const al of data?.albums ?? []) {
          if (al?.id && al?.artistId && al?.title) {
            albumsByKey.set(
              `${al.artistId}|||${String(al.title).trim().toLowerCase()}`,
              String(al.id)
            );
          }
        }
      }
    } catch {
      // Segue com mapas vazios e cria conforme necessario
    }

    const artistPromises = new Map<string, Promise<string>>();
    const albumPromises = new Map<
      string,
      Promise<{ artistId: string; albumId: string; coverKey: string | null }>
    >();

    const ensureArtistId = (artistName: string, genres: string[]): Promise<string> => {
      const norm = artistName.trim().toLowerCase();
      if (artistsByName.has(norm)) {
        return Promise.resolve(artistsByName.get(norm)!);
      }
      if (artistPromises.has(norm)) {
        return artistPromises.get(norm)!;
      }
      const promise = (async () => {
        const resp = await fetch("/api/admin/music/artists", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: artistName.trim(),
            pictureUrl: "https://picsum.photos/seed/artist-default/320/320",
            genres,
          }),
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data?.artist?.id) {
          throw new Error(data?.error || `Falha ao preparar artista ${artistName}`);
        }
        const id = String(data.artist.id);
        artistsByName.set(norm, id);
        return id;
      })();
      artistPromises.set(norm, promise);
      return promise;
    };

    const ensureAlbumContext = (
      artistName: string,
      albumName: string,
      year: number | null,
      genres: string[],
      coverData: Uint8Array | null,
      coverMimeType: string | null
    ): Promise<{ artistId: string; albumId: string; coverKey: string | null }> => {
      const groupNormKey = `${artistName.trim().toLowerCase()}|||${albumName.trim().toLowerCase()}`;
      if (albumPromises.has(groupNormKey)) {
        return albumPromises.get(groupNormKey)!;
      }

      const promise = (async () => {
        const artistId = await ensureArtistId(artistName, genres);
        const albumLookupKey = `${artistId}|||${albumName.trim().toLowerCase()}`;
        let albumId = albumsByKey.get(albumLookupKey) || "";

        if (!albumId) {
          const validYear =
            year && Number.isInteger(year) && year >= 1 && year <= 9999
              ? year
              : new Date().getFullYear();

          const resp = await fetch("/api/admin/music/albums", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: albumName.trim(),
              artistId,
              year: validYear,
              coverUrl: "https://picsum.photos/seed/album-default/800/800",
              genres,
              tags: [],
            }),
          });
          const data = await resp.json().catch(() => null);
          if (!resp.ok || !data?.album?.id) {
            throw new Error(data?.error || `Falha ao preparar álbum ${albumName}`);
          }
          albumId = String(data.album.id);
          albumsByKey.set(albumLookupKey, albumId);
        }

        let coverKey: string | null = null;
        if (coverData && coverMimeType) {
          try {
            const coverMeta = resolveCoverUploadMeta(coverMimeType);
            const presignResp = await fetch("/api/admin/music/upload/presign", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                kind: "cover",
                artistId,
                albumId,
                filename: coverMeta.filename,
                contentType: coverMeta.contentType,
              }),
            });
            const presign = await presignResp.json().catch(() => null);
            if (presignResp.ok && presign?.url && presign?.key) {
              const blob = new Blob([new Uint8Array(coverData)], {
                type: coverMeta.contentType,
              });
              await uploadWithProgress(presign.url, blob, coverMeta.contentType);
              coverKey = String(presign.key);
            }
          } catch {
            // Se falhar upload da capa, prossegue com capa padrao
          }
        }

        return { artistId, albumId, coverKey };
      })();

      albumPromises.set(groupNormKey, promise);
      return promise;
    };

    const processItem = async (item: UploadItem) => {
      if (!item.parsed) return;

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "uploading", progress: 5, error: null } : i
        )
      );

      try {
        const { parsed } = item;
        const artistName = parsed.artist || "Artista Desconhecido";
        const albumName = parsed.album || "Álbum Desconhecido";
        const trackTitle =
          parsed.title || item.file.name.replace(/\.[^.]+$/, "");

        // Verificar se a faixa ja existe no catalogo
        const checkResp = await fetch(
          `/api/admin/music/tracks?artist=${encodeURIComponent(
            artistName
          )}&album=${encodeURIComponent(albumName)}&title=${encodeURIComponent(
            trackTitle
          )}`,
          { cache: "no-store" }
        ).catch(() => null);

        if (checkResp && checkResp.ok) {
          const checkData = await checkResp.json().catch(() => null);
          if (Array.isArray(checkData?.tracks) && checkData.tracks.length > 0) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: "done",
                      progress: 100,
                      createdTrackId: checkData.tracks[0].id,
                      error: "Já existe no catálogo (pulado)",
                    }
                  : i
              )
            );
            return;
          }
        }

        // Garantir artista, album e capa no storage
        const { artistId, albumId, coverKey } = await ensureAlbumContext(
          artistName,
          albumName,
          parsed.year,
          parsed.genres,
          parsed.coverData,
          parsed.coverMimeType
        );

        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, progress: 15 } : i))
        );

        // Solicitar URL presignada para o audio
        const audioMeta = resolveAudioUploadMeta(item.file, parsed.format);
        const presignResp = await fetch("/api/admin/music/upload/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "audio",
            artistId,
            albumId,
            filename: audioMeta.filename,
            contentType: audioMeta.contentType,
          }),
        });

        const presign = await presignResp.json().catch(() => null);
        if (!presignResp.ok || !presign?.url || !presign?.key) {
          throw new Error(presign?.error || "Falha ao obter URL presignada do storage");
        }

        // Enviar arquivo direto ao storage com barra de progresso real
        await uploadWithProgress(
          presign.url,
          item.file,
          audioMeta.contentType,
          (pct) => {
            const mapped = 15 + Math.round(pct * 0.7);
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, progress: mapped } : i
              )
            );
          }
        );

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "creating", progress: 90 } : i
          )
        );

        const validYear =
          parsed.year &&
          Number.isInteger(parsed.year) &&
          parsed.year >= 1 &&
          parsed.year <= 9999
            ? parsed.year
            : undefined;

        const createResp = await fetch("/api/admin/music/tracks/from-id3", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: trackTitle,
            artistName,
            albumName,
            year: validYear,
            trackNumber: parsed.trackNumber,
            discNumber: parsed.discNumber,
            durationSec: parsed.durationSec,
            genres: parsed.genres,
            mbid: parsed.mbid,
            bitrate: parsed.bitrate,
            sampleRate: parsed.sampleRate,
            format: audioMeta.format,
            audioUrl: presign.key,
            coverUrl: coverKey || undefined,
            status: parsed.isValid ? "READY" : "PENDING_METADATA",
            statusNote: parsed.isValid
              ? null
              : parsed.validationErrors.join(", "),
            lyricsLrc: item.lrc?.content || null,
            lyricsPlain:
              item.lrc?.parsed.plainText || parsed.lyricsPlain || null,
          }),
        });

        if (!createResp.ok) {
          const errData = await createResp.json().catch(() => ({}));
          throw new Error(errData.error || "Falha ao registrar faixa no banco");
        }

        const result = await createResp.json();

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "done",
                  progress: 100,
                  createdTrackId: result.track?.id ?? null,
                }
              : i
          )
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "error",
                  error:
                    err instanceof Error ? err.message : "Erro desconhecido",
                }
              : i
          )
        );
      }
    };

    const chunks: UploadItem[][] = [];
    for (let i = 0; i < toProcess.length; i += PARALLEL_UPLOADS) {
      chunks.push(toProcess.slice(i, i + PARALLEL_UPLOADS));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(processItem));
    }

    setIsProcessing(false);
  }, [items]);

  const groups = useMemo(() => groupByAlbum(items), [items]);
  const pendingCount = items.filter((i) => i.status === "pending").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const totalTracks = items.length;

  const batchProgress = useMemo(() => {
    if (items.length === 0) return { percent: 0, uploadedBytes: 0, totalBytes: 0 };
    const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
    const uploadedBytes = items.reduce((sum, item) => {
      const ratio = item.status === "done" ? 1 : (item.progress || 0) / 100;
      return sum + Math.round(item.file.size * ratio);
    }, 0);
    const percent =
      totalBytes > 0
        ? Math.min(100, Math.round((uploadedBytes / totalBytes) * 100))
        : 0;
    return { percent, uploadedBytes, totalBytes };
  }, [items]);

  return (
    <div className="space-y-6 pb-12">
      <MusicAdminNav />

      {/* Header */}
      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-400">
              <Upload size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                Upload de Músicas (ID3 + LRC)
              </h1>
              <p className="text-xs text-zinc-400">
                Leitura de tags ID3 no navegador, pareamento de arquivos .lrc e envio direto ao storage
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

      {/* Drop Zone */}
      <section
        className={`relative rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all ${
          isDragging
            ? "border-fuchsia-500 bg-fuchsia-500/10 scale-[1.01]"
            : "border-white/15 bg-zinc-900/40 hover:border-fuchsia-500/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);

          const dtItems = e.dataTransfer.items;
          if (dtItems) {
            const files: File[] = [];
            const promises: Promise<void>[] = [];

            for (let i = 0; i < dtItems.length; i++) {
              const item = dtItems[i];
              if (item.kind === "file") {
                const entry = item.webkitGetAsEntry?.();
                if (entry) {
                  promises.push(traverseEntry(entry, files));
                } else {
                  const file = item.getAsFile();
                  if (file) files.push(file);
                }
              }
            }

            void Promise.all(promises).then(() => {
              if (files.length > 0) void addFiles(files);
            });
          } else if (e.dataTransfer.files.length > 0) {
            void addFiles(e.dataTransfer.files);
          }
        }}
      >
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-expect-error - webkitdirectory suportado nos navegadores
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void addFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />

        <input
          ref={filesInputRef}
          type="file"
          multiple
          accept=".mp3,.flac,.wav,.aac,.m4a,.ogg,.opus,.lrc"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void addFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />

        <FolderOpen size={56} className="mx-auto mb-4 text-fuchsia-400" />
        <div className="text-lg sm:text-xl font-bold text-white">
          Arraste uma pasta ou arquivos de música aqui
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/40 px-4 py-2.5 font-bold text-fuchsia-300 hover:bg-fuchsia-500/25"
          >
            <FolderOpen size={15} />
            Selecionar Pasta
          </button>
          <button
            type="button"
            onClick={() => filesInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 font-bold text-zinc-200 hover:bg-white/10"
          >
            <FileAudio size={15} />
            Selecionar Arquivos (.mp3, .flac, .lrc)
          </button>
        </div>
        <div className="mt-4 text-xs text-zinc-400">
          Suporta pastas com subpastas · MP3, FLAC, WAV, AAC, M4A, OGG + letras .LRC pareadas pelo nome
        </div>
      </section>

      {globalError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs sm:text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Stats */}
      {totalTracks > 0 && (
        <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
          <div className="rounded-xl bg-zinc-900/60 border border-white/10 px-4 py-2 text-zinc-200">
            <Music size={14} className="mr-2 inline text-fuchsia-400" />
            <span className="font-bold text-white">{totalTracks}</span> faixas
          </div>
          <div className="rounded-xl bg-zinc-900/60 border border-white/10 px-4 py-2 text-zinc-200">
            <Disc3 size={14} className="mr-2 inline text-fuchsia-400" />
            <span className="font-bold text-white">{groups.length}</span> álbuns
          </div>
          {doneCount > 0 && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-emerald-300">
              <CheckCircle size={14} className="mr-1.5 inline" />
              {doneCount} enviados
            </div>
          )}
          {pendingCount > 0 && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-amber-300">
              <Clock size={14} className="mr-1.5 inline" />
              {pendingCount} pendentes
            </div>
          )}
          {errorCount > 0 && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2 text-red-300">
              <AlertCircle size={14} className="mr-1.5 inline" />
              {errorCount} com erro
            </div>
          )}
          {isParsing && (
            <div className="rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 px-4 py-2 text-fuchsia-300">
              <Loader2 size={14} className="mr-1.5 inline animate-spin" />
              Lendo metadados ID3...
            </div>
          )}
        </div>
      )}

      {/* Barra de Progresso do Lote e por Arquivo */}
      {(isProcessing || doneCount > 0) && totalTracks > 0 && (
        <section className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              {isProcessing ? (
                <Loader2 size={22} className="animate-spin text-fuchsia-400" />
              ) : (
                <CheckCircle size={22} className="text-emerald-400" />
              )}
              <div>
                <div className="font-bold text-white text-sm sm:text-base">
                  {isProcessing
                    ? "Enviando lote para o storage..."
                    : "Processamento do lote concluído"}
                </div>
                <div className="text-xs text-zinc-400">
                  {doneCount} de {totalTracks} faixas ·{" "}
                  {formatSize(batchProgress.uploadedBytes)} de{" "}
                  {formatSize(batchProgress.totalBytes)}
                </div>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-fuchsia-400">
              {batchProgress.percent}%
            </div>
          </div>

          <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10 mb-4">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all duration-300"
              style={{ width: `${batchProgress.percent}%` }}
            />
          </div>

          {(() => {
            const activeUploads = items.filter(
              (i) => i.status === "uploading" || i.status === "creating"
            );
            if (activeUploads.length === 0) return null;
            return (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Arquivos em envio agora:
                </div>
                {activeUploads.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl bg-black/40 border border-white/5 p-3"
                  >
                    <Loader2
                      size={15}
                      className="animate-spin text-fuchsia-400 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate text-xs sm:text-sm">
                        {item.parsed?.title || item.file.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {item.parsed?.artist} · {item.parsed?.album}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400 shrink-0 font-mono">
                      {item.progress}%
                    </div>
                    <div className="w-20 sm:w-28 h-2 rounded-full bg-white/10 overflow-hidden shrink-0">
                      <div
                        className="h-full bg-fuchsia-500 transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* Actions */}
      {totalTracks > 0 && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={processAll}
            disabled={isProcessing || pendingCount === 0 || isParsing}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20 transition-all hover:opacity-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload size={16} />
                Enviar {pendingCount} faixa{pendingCount !== 1 ? "s" : ""}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setItems([])}
            disabled={isProcessing}
            className="rounded-xl border border-white/10 bg-zinc-900/60 px-5 py-3 text-xs sm:text-sm font-bold text-zinc-300 hover:text-white disabled:opacity-50"
          >
            Limpar tudo
          </button>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="sm:ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-xs sm:text-sm font-bold text-zinc-300 hover:text-white"
          >
            {showDetails ? <EyeOff size={15} /> : <Eye size={15} />}
            {showDetails ? "Ocultar detalhes" : "Mostrar detalhes"}
          </button>
        </div>
      )}

      {/* Album Groups */}
      {groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((group) => {
            const groupKey = `${group.artistName}|||${group.albumName}`;
            const isExpanded = !collapsedGroups.has(groupKey);
            const groupDone = group.tracks.filter(
              (t) => t.status === "done"
            ).length;
            const groupTotal = group.tracks.length;
            const allDone = groupDone === groupTotal;

            return (
              <section
                key={groupKey}
                className={`rounded-2xl border overflow-hidden transition-colors ${
                  allDone
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-white/10 bg-zinc-900/40"
                }`}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.03]"
                  onClick={() => toggleGroup(group.artistName, group.albumName)}
                >
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl bg-black/50 border border-white/10 overflow-hidden">
                    {group.coverData ? (
                      <img
                        src={URL.createObjectURL(
                          new Blob([new Uint8Array(group.coverData)], {
                            type: group.coverMimeType || "image/jpeg",
                          })
                        )}
                        alt={group.albumName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Disc3 size={26} className="text-fuchsia-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate">
                      {group.albumName}
                    </div>
                    <div className="text-xs sm:text-sm text-zinc-400 truncate">
                      {group.artistName}
                      {group.year ? ` · ${group.year}` : ""}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {groupTotal} faixa{groupTotal !== 1 ? "s" : ""}
                      {groupDone > 0 && (
                        <span className="text-emerald-400 ml-2 font-bold">
                          ({groupDone}/{groupTotal} enviadas)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGroup(group.artistName, group.albumName);
                    }}
                    className="shrink-0 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-red-400"
                    title="Remover álbum da fila"
                  >
                    <X size={18} />
                  </button>

                  <div className="shrink-0 text-zinc-400">
                    {isExpanded ? (
                      <ChevronDown size={20} />
                    ) : (
                      <ChevronRight size={20} />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/10 divide-y divide-white/5">
                    {group.tracks.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          item.status === "done" ? "bg-emerald-500/5" : ""
                        }`}
                      >
                        <div className="w-7 text-center text-xs text-zinc-400 font-mono">
                          {item.parsed?.trackNumber || "-"}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-bold text-white">
                            {item.parsed?.title || item.file.name}
                          </div>
                          {showDetails && item.parsed && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-zinc-400">
                              <span>
                                {formatDuration(item.parsed.durationSec)}
                              </span>
                              <span className="uppercase font-mono text-zinc-300">
                                {item.parsed.format}
                              </span>
                              <span>{formatBitrate(item.parsed.bitrate)}</span>
                              {item.parsed.sampleRate && (
                                <span>{item.parsed.sampleRate} Hz</span>
                              )}
                              {item.parsed.mbid && (
                                <span
                                  className="text-emerald-400 font-bold"
                                  title="MusicBrainz Recording ID"
                                >
                                  MBID
                                </span>
                              )}
                              {item.lrc && (
                                <span
                                  className="text-fuchsia-300 font-bold flex items-center gap-1"
                                  title={`Letra sincronizada: ${item.lrc.parsed.lines.length} linhas`}
                                >
                                  <FileText size={11} />
                                  LRC ({item.lrc.parsed.lines.length})
                                </span>
                              )}
                              {!item.lrc && item.parsed.lyricsPlain && (
                                <span
                                  className="text-violet-300 font-bold flex items-center gap-1"
                                  title="Letra embutida no ID3"
                                >
                                  <FileText size={11} />
                                  LETRA ID3
                                </span>
                              )}
                            </div>
                          )}
                          {(item.status === "uploading" ||
                            item.status === "creating") && (
                            <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full bg-fuchsia-500 transition-all duration-200"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}
                          {item.error && (
                            <div className="text-xs text-red-400 mt-1">
                              {item.error}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          {item.status === "parsing" && (
                            <Loader2
                              size={16}
                              className="animate-spin text-fuchsia-400"
                            />
                          )}
                          {item.status === "pending" && item.parsed?.isValid && (
                            <div
                              className="h-2.5 w-2.5 rounded-full bg-fuchsia-400"
                              title="Pronto para envio"
                            />
                          )}
                          {item.status === "pending" &&
                            item.parsed &&
                            !item.parsed.isValid && (
                              <span title="Metadados incompletos (será salvo como PENDING_METADATA)">
                                <AlertCircle
                                  size={16}
                                  className="text-amber-400"
                                />
                              </span>
                            )}
                          {(item.status === "uploading" ||
                            item.status === "creating") && (
                            <div className="flex items-center gap-2">
                              <Loader2
                                size={15}
                                className="animate-spin text-fuchsia-400"
                              />
                              <span className="text-xs font-mono text-fuchsia-300">
                                {item.progress}%
                              </span>
                            </div>
                          )}
                          {item.status === "done" && (
                            <CheckCircle
                              size={16}
                              className="text-emerald-400"
                            />
                          )}
                          {item.status === "error" && (
                            <AlertCircle size={16} className="text-red-400" />
                          )}
                        </div>

                        {item.status !== "uploading" &&
                          item.status !== "creating" && (
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="shrink-0 rounded-full p-1 text-zinc-400 hover:text-red-400"
                            >
                              <X size={14} />
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {totalTracks === 0 && !isParsing && (
        <div className="text-center py-12 text-zinc-500">
          <Music size={48} className="mx-auto mb-3 opacity-30 text-fuchsia-400" />
          <div className="text-sm font-bold text-zinc-400">
            Nenhuma música na fila de upload
          </div>
          <div className="text-xs mt-1">
            Arraste uma pasta com arquivos de áudio e letras .lrc para começar
          </div>
        </div>
      )}
    </div>
  );
}

async function traverseEntry(
  entry: FileSystemEntry,
  files: File[]
): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise((resolve) => {
      fileEntry.file((file) => {
        Object.defineProperty(file, "webkitRelativePath", {
          value: entry.fullPath.slice(1),
          writable: false,
        });
        files.push(file);
        resolve();
      });
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();

    return new Promise((resolve) => {
      const readEntries = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve();
            return;
          }

          for (const childEntry of entries) {
            await traverseEntry(childEntry, files);
          }

          readEntries();
        });
      };
      readEntries();
    });
  }
}
