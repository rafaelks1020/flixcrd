export type PlayerTrackSource =
  | "album"
  | "playlist"
  | "radio"
  | "search"
  | "manual"
  | "history"
  | "recommendation";

export type PlayerTrack = {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  albumId?: string;
  coverUrl: string;
  streamUrl: string;
  lyricsLrc?: string | null;
  hasLyrics?: boolean;
  source?: PlayerTrackSource;
};

export type RawPlayable = {
  id?: string;
  title?: string;
  artistName?: string;
  albumTitle?: string;
  albumId?: string;
  coverUrl?: string | null;
  streamUrl?: string | null;
  lyricsLrc?: string | null;
  hasLyrics?: boolean;
  source?: PlayerTrackSource;
  artist?: { name?: string | null };
  album?: { id?: string; title?: string; coverUrl?: string | null };
};

export function toPlayerTrack(raw: RawPlayable, source?: PlayerTrackSource): PlayerTrack | null {
  if (!raw.id || !raw.streamUrl) return null;
  return {
    id: raw.id,
    title: raw.title || "Sem título",
    artistName: raw.artistName || raw.artist?.name || "Artista",
    albumTitle: raw.albumTitle || raw.album?.title || "",
    albumId: raw.albumId || raw.album?.id,
    coverUrl: raw.coverUrl || raw.album?.coverUrl || "",
    streamUrl: raw.streamUrl,
    lyricsLrc: raw.lyricsLrc,
    hasLyrics: raw.hasLyrics,
    source: raw.source || source,
  };
}

export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
