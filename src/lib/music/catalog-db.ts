import { Prisma, TrackFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveMusicImage, streamUrl } from "./http";

export const trackInclude = { artist: true, album: true } satisfies Prisma.TrackInclude;
export type CatalogTrack = Prisma.TrackGetPayload<{ include: typeof trackInclude }>;
const rating = (score: number | null, votes: number | null) => score === null ? undefined : { score, votes: votes ?? 0 };

export type Track = {
  id: string; title: string; artistId: string; albumId: string; durationSec: number;
  streamUrl: string; format: TrackFormat; genres: string[]; description: string | null;
  trackNumber: number | null;
};
export async function presentTrack(t: CatalogTrack) {
  return {
    id: t.id, title: t.title, artistId: t.artistId, albumId: t.albumId,
    artistName: t.artist.name, albumTitle: t.album.title,
    coverUrl: await resolveMusicImage(t.album.coverUrl), durationSec: t.durationSec,
    streamUrl: streamUrl(t.id), format: t.format, genres: t.genres,
    description: t.description, rating: rating(t.ratingScore, t.ratingVotes),
    trackNumber: t.trackNumber, lyricsLrc: t.lyricsLrc, hasLyrics: t.hasLyrics,
  };
}
export async function getArtistById(id: string) {
  const artist = await prisma.artist.findUnique({ where: { id } });
  if (!artist) return null;
  return { ...artist, pictureUrl: await resolveMusicImage(artist.pictureUrl), bannerUrl: artist.bannerUrl ? await resolveMusicImage(artist.bannerUrl) : null, rating: rating(artist.ratingScore, artist.ratingVotes) };
}
export async function getAlbumById(id: string) {
  const album = await prisma.album.findUnique({ where: { id } });
  return album ? presentAlbum(album) : null;
}
type AlbumRow = Prisma.AlbumGetPayload<object> & { artist?: { name: string } };
async function presentAlbum(album: AlbumRow) {
  return { ...album, coverUrl: await resolveMusicImage(album.coverUrl), backdropUrl: album.backdropUrl ? await resolveMusicImage(album.backdropUrl) : null, artistName: album.artist?.name, rating: rating(album.ratingScore, album.ratingVotes) };
}
export async function getTrackById(id: string) {
  const track = await prisma.track.findFirst({ where: { id, status: "READY" }, include: trackInclude });
  return track ? presentTrack(track) : null;
}
export async function getTracksForAlbum(albumId: string) {
  const tracks = await prisma.track.findMany({ where: { albumId, status: "READY" }, include: trackInclude, orderBy: [{ trackNumber: "asc" }, { createdAt: "asc" }] });
  return Promise.all(tracks.map(presentTrack));
}
export async function getAlbumsForArtist(artistId: string) {
  const albums = await prisma.album.findMany({ where: { artistId }, orderBy: [{ year: "desc" }, { createdAt: "desc" }] });
  return Promise.all(albums.map(presentAlbum));
}
export async function listAlbums(params?: { limit?: number }) {
  const albums = await prisma.album.findMany({ take: params?.limit ?? 24, include: { artist: true }, orderBy: { createdAt: "desc" } });
  return Promise.all(albums.map(presentAlbum));
}
export async function listTrendingAlbums(params?: { limit?: number }) {
  const albums = await prisma.album.findMany({ take: params?.limit ?? 12, include: { artist: true }, orderBy: [{ ratingScore: "desc" }, { ratingVotes: "desc" }, { createdAt: "desc" }] });
  return Promise.all(albums.map(presentAlbum));
}
export async function listPopularTracks(params?: { limit?: number }) {
  const tracks = await prisma.track.findMany({ where: { status: "READY" }, take: params?.limit ?? 20, include: trackInclude, orderBy: [{ playCount: "desc" }, { ratingScore: "desc" }, { createdAt: "desc" }] });
  return Promise.all(tracks.map(presentTrack));
}
export type SearchFilters = { genre?: string; yearFrom?: number; yearTo?: number; sortBy?: string };
export async function searchCatalog(query: string, filters: SearchFilters = {}) {
  const q = query.trim();
  if (!q && !filters.genre) return { artists: [], albums: [], tracks: [] };
  const genre = filters.genre ? { genres: { has: filters.genre } } : {};
  const match = q ? { contains: q, mode: "insensitive" as const } : undefined;
  const year = filters.yearFrom !== undefined || filters.yearTo !== undefined ? { gte: filters.yearFrom, lte: filters.yearTo } : undefined;
  const trackOrder: Prisma.TrackOrderByWithRelationInput[] = filters.sortBy === "title" ? [{ title: "asc" }] : filters.sortBy === "popularity" ? [{ playCount: "desc" }, { ratingScore: "desc" }] : [{ createdAt: "desc" }];
  const [artists, albums, tracks] = await Promise.all([
    prisma.artist.findMany({ where: { ...genre, name: match }, take: 20 }),
    prisma.album.findMany({ where: { ...genre, title: match, year }, include: { artist: true }, take: 20, orderBy: filters.sortBy === "title" ? { title: "asc" } : { createdAt: "desc" } }),
    prisma.track.findMany({ where: { ...genre, title: match, status: "READY", ...(year ? { album: { year } } : {}) }, include: trackInclude, take: 30, orderBy: trackOrder }),
  ]);
  return { artists, albums: await Promise.all(albums.map(presentAlbum)), tracks: await Promise.all(tracks.map(presentTrack)) };
}
export function searchByGenre(genre: string, query = "") { return searchCatalog(query, { genre }); }
export async function getAvailableGenres() {
  const groups = await Promise.all([
    prisma.artist.findMany({ select: { genres: true } }),
    prisma.album.findMany({ select: { genres: true } }),
    prisma.track.findMany({ where: { status: "READY" }, select: { genres: true } }),
  ]);
  return [...new Set(groups.flat().flatMap(row => row.genres))].sort();
}
