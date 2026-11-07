import { parseBlob, type IAudioMetadata } from "music-metadata";

export type ParsedID3 = {
  title: string | null;
  artist: string | null;
  album: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  durationSec: number;
  genres: string[];
  mbid: string | null;
  bitrate: number | null;
  sampleRate: number | null;
  format: "mp3" | "flac" | "wav" | "aac" | "ogg";
  coverData: Uint8Array | null;
  coverMimeType: string | null;
  lyricsPlain: string | null;
  isValid: boolean;
  validationErrors: string[];
};

function inferFormatFromFilename(filename: string): ParsedID3["format"] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".flac")) return "flac";
  if (lower.endsWith(".wav")) return "wav";
  if (lower.endsWith(".aac") || lower.endsWith(".m4a")) return "aac";
  if (lower.endsWith(".ogg") || lower.endsWith(".opus")) return "ogg";
  return "mp3";
}

function inferFormatFromContainer(container: string | undefined): ParsedID3["format"] | null {
  if (!container) return null;
  const c = container.toLowerCase();
  if (c.includes("flac")) return "flac";
  if (c.includes("wav") || c.includes("wave")) return "wav";
  if (c.includes("aac") || c.includes("m4a") || c.includes("mp4")) return "aac";
  if (c.includes("ogg") || c.includes("opus") || c.includes("vorbis")) return "ogg";
  if (c.includes("mp3") || c.includes("mpeg")) return "mp3";
  return null;
}

export async function parseID3FromFile(file: File): Promise<ParsedID3> {
  const validationErrors: string[] = [];

  let metadata: IAudioMetadata;
  try {
    metadata = await parseBlob(file);
  } catch (err) {
    return {
      title: null,
      artist: null,
      album: null,
      year: null,
      trackNumber: null,
      discNumber: null,
      durationSec: 0,
      genres: [],
      mbid: null,
      bitrate: null,
      sampleRate: null,
      format: inferFormatFromFilename(file.name),
      coverData: null,
      coverMimeType: null,
      lyricsPlain: null,
      isValid: false,
      validationErrors: [`Falha ao ler metadados: ${err instanceof Error ? err.message : "erro desconhecido"}`],
    };
  }

  const { common, format } = metadata;

  const title = common.title?.trim() || null;
  const artist = (common.artist || common.albumartist)?.trim() || null;
  const album = common.album?.trim() || null;
  const year = common.year ?? null;
  const trackNumber = common.track?.no ?? null;
  const discNumber = common.disk?.no ?? null;
  const durationSec = Math.round(format.duration ?? 0);
  const genres = Array.isArray(common.genre) ? common.genre.filter(Boolean) : [];

  const mbid = common.musicbrainz_recordingid?.trim() || null;

  const bitrate = format.bitrate ? Math.round(format.bitrate / 1000) : null;
  const sampleRate = format.sampleRate ? Math.round(format.sampleRate) : null;

  const detectedFormat = inferFormatFromContainer(format.container) ?? inferFormatFromFilename(file.name);

  let coverData: Uint8Array | null = null;
  let coverMimeType: string | null = null;
  if (common.picture && common.picture.length > 0) {
    const pic = common.picture[0];
    coverData = pic.data instanceof Uint8Array ? pic.data : new Uint8Array(pic.data);
    coverMimeType = pic.format || "image/jpeg";
  }

  let lyricsPlain: string | null = null;
  if (common.lyrics && common.lyrics.length > 0) {
    const parts = common.lyrics
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          if (typeof item.text === "string" && item.text.trim()) return item.text;
          if (Array.isArray(item.syncText) && item.syncText.length > 0) {
            return item.syncText.map((s) => s.text).filter(Boolean).join("\n");
          }
        }
        return "";
      })
      .filter(Boolean);
    lyricsPlain = parts.join("\n").trim() || null;
  }

  if (!title) validationErrors.push("Título ausente");
  if (!artist) validationErrors.push("Artista ausente");
  if (!album) validationErrors.push("Álbum ausente");
  if (!trackNumber) validationErrors.push("Número da faixa ausente");
  if (durationSec <= 0) validationErrors.push("Duração inválida");

  const isValid = validationErrors.length === 0;

  return {
    title,
    artist,
    album,
    year,
    trackNumber,
    discNumber,
    durationSec,
    genres,
    mbid,
    bitrate,
    sampleRate,
    format: detectedFormat,
    coverData,
    coverMimeType,
    lyricsPlain,
    isValid,
    validationErrors,
  };
}

export function normalizeArtistName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeAlbumName(name: string): string {
  return name.trim().toLowerCase();
}

export function generateStoragePath(
  artist: string,
  album: string,
  trackNumber: number | null,
  title: string,
  format: string
): string {
  const safeArtist = artist.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").substring(0, 50);
  const safeAlbum = album.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").substring(0, 50);
  const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").substring(0, 50);
  const trackPrefix = trackNumber ? `${String(trackNumber).padStart(2, "0")}_` : "";

  return `music/tracks/${safeArtist}/${safeAlbum}/${trackPrefix}${safeTitle}.${format}`;
}

export function resolveAudioUploadMeta(
  file: File,
  fallbackFormat?: ParsedID3["format"]
): { filename: string; contentType: string; format: ParsedID3["format"] } {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (ext === "flac") {
    return { filename: file.name, contentType: "audio/flac", format: "flac" };
  }
  if (ext === "wav" || ext === "wave") {
    const safeName = ext === "wave" ? file.name.replace(/\.wave$/i, ".wav") : file.name;
    return { filename: safeName, contentType: "audio/wav", format: "wav" };
  }
  if (ext === "aac") {
    return { filename: file.name, contentType: "audio/aac", format: "aac" };
  }
  if (ext === "m4a") {
    return { filename: file.name, contentType: "audio/mp4", format: "aac" };
  }
  if (ext === "ogg") {
    return { filename: file.name, contentType: "audio/ogg", format: "ogg" };
  }
  if (ext === "opus") {
    return { filename: file.name, contentType: "audio/opus", format: "ogg" };
  }
  if (ext === "mp3") {
    return { filename: file.name, contentType: "audio/mpeg", format: "mp3" };
  }
  const fmt = fallbackFormat || "mp3";
  const mimeMap: Record<ParsedID3["format"], string> = {
    mp3: "audio/mpeg",
    flac: "audio/flac",
    wav: "audio/wav",
    aac: "audio/aac",
    ogg: "audio/ogg",
  };
  return {
    filename: `${file.name}.${fmt}`,
    contentType: mimeMap[fmt],
    format: fmt,
  };
}

export function resolveCoverUploadMeta(mimeType: string | null, originalName?: string): {
  filename: string;
  contentType: string;
} {
  const lower = (mimeType || "").toLowerCase();
  const extFromName = originalName?.split(".").pop()?.toLowerCase();
  if (lower.includes("png") || extFromName === "png") {
    return { filename: "cover.png", contentType: "image/png" };
  }
  if (lower.includes("webp") || extFromName === "webp") {
    return { filename: "cover.webp", contentType: "image/webp" };
  }
  if (lower.includes("gif") || extFromName === "gif") {
    return { filename: "cover.gif", contentType: "image/gif" };
  }
  return { filename: "cover.jpg", contentType: "image/jpeg" };
}

export function uploadWithProgress(
  url: string,
  body: Blob | File,
  contentType: string,
  onProgress?: (percent: number, loaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);

    if (onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && evt.total > 0) {
          const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
          onProgress(pct, evt.loaded, evt.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100, body.size, body.size);
        resolve();
      } else {
        reject(new Error(`Falha no envio ao Wasabi (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Erro de rede durante o upload para o Wasabi"));
    };

    xhr.send(body);
  });
}

export function toStorageOrHttpsUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("music/covers/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const idx = parsed.pathname.indexOf("/music/covers/");
    if (idx !== -1) {
      return decodeURIComponent(parsed.pathname.slice(idx + 1));
    }
  } catch {
    // URL malformada tratada na validacao do servidor
  }
  return trimmed;
}
