import { toPlayerTrack, type PlayerTrack, type PlayerTrackSource, type RawPlayable } from "./player-types";

export async function loadPlayContext(trackId: string, source: PlayerTrackSource = "album") {
  const resp = await fetch(`/api/music/catalog/play-context?trackId=${encodeURIComponent(trackId)}`);
  if (!resp.ok) return null;
  const data = (await resp.json().catch(() => null)) as { startIndex?: number; tracks?: RawPlayable[] } | null;
  if (!data || !Array.isArray(data.tracks)) return null;
  const tracks = data.tracks
    .map((track) => toPlayerTrack(track, source))
    .filter((track): track is PlayerTrack => track !== null);
  if (tracks.length === 0) return null;
  const wanted = typeof data.startIndex === "number" ? data.startIndex : 0;
  const startIndex = Math.max(0, Math.min(tracks.length - 1, wanted));
  return { tracks, startIndex };
}
