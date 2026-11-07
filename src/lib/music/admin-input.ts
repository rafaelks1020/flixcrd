import { Prisma, TrackFormat, TrackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, text, id, number, list, image, type Body } from "./http";
import { assertMusicKey } from "./storage";

function optionalNumber(value: unknown, field: string, max: number): number | null {
  return value === undefined || value === null || value === "" ? null : number(value, field, 1, max);
}
export function artistData(body: Body) {
  return {
    name: text(body.name, "name", 300, true), pictureUrl: image(body.pictureUrl, "pictureUrl", true),
    bannerUrl: image(body.bannerUrl, "bannerUrl") || null, bio: text(body.bio, "bio", 20000) || null,
    mbid: text(body.mbid, "mbid", 100) || null, genres: list(body.genres, "genres"),
  };
}
export function albumData(body: Body) {
  return {
    title: text(body.title, "title", 300, true), artistId: id(body.artistId, "artistId"),
    year: number(body.year, "year", 1, 9999), coverUrl: image(body.coverUrl, "coverUrl", true),
    backdropUrl: image(body.backdropUrl, "backdropUrl") || null, label: text(body.label, "label", 300) || null,
    description: text(body.description, "description", 20000) || null, mbid: text(body.mbid, "mbid", 100) || null,
    genres: list(body.genres, "genres"), tags: list(body.tags, "tags"),
  };
}
export function trackFields(body: Body, fromId3 = false) {
  const audioUrl = text(body.audioUrl, "audioUrl", 1024, true);
  assertMusicKey(audioUrl);
  if (audioUrl.startsWith("music/covers/")) fail(400, "Chave de áudio inválida");
  if (typeof body.format !== "string" || !Object.values(TrackFormat).includes(body.format as TrackFormat)) fail(400, "Formato inválido");
  const status = body.status ?? "READY";
  if (typeof status !== "string" || !Object.values(TrackStatus).includes(status as TrackStatus)) fail(400, "Status inválido");
  const lyricsLrc = text(body.lyricsLrc, "lyricsLrc", 200000) || null;
  const lyricsPlain = text(body.lyricsPlain, "lyricsPlain", 200000) || null;
  return {
    title: text(body.title, "title", 300, true), audioUrl, format: body.format as TrackFormat,
    durationSec: number(body.durationSec, "durationSec", fromId3 ? 0 : 1, 604800, fromId3 ? 0 : undefined),
    genres: list(body.genres, "genres"), description: text(body.description, "description", 20000) || null,
    mbid: text(body.mbid, "mbid", 100) || null, trackNumber: optionalNumber(body.trackNumber, "trackNumber", 100000),
    discNumber: optionalNumber(body.discNumber, "discNumber", 10000), bitrate: optionalNumber(body.bitrate, "bitrate", 100000000),
    sampleRate: optionalNumber(body.sampleRate, "sampleRate", 10000000), status: status as TrackStatus,
    statusNote: text(body.statusNote, "statusNote", 2000) || null, lyricsLrc, lyricsPlain, hasLyrics: !!(lyricsLrc || lyricsPlain),
  };
}
export async function trackData(body: Body) {
  const data = { ...trackFields(body), artistId: id(body.artistId, "artistId"), albumId: id(body.albumId, "albumId") };
  const album = await prisma.album.findUnique({ where: { id: data.albumId }, select: { artistId: true } });
  if (!album || album.artistId !== data.artistId) fail(400, "Álbum e artista incompatíveis");
  return data;
}

export async function trackUpdateData(body: Body, trackId: string) {
  const current = await prisma.track.findUnique({ where: { id: trackId }, select: { audioUrl: true, lyricsLrc: true, lyricsPlain: true } });
  if (!current) fail(404, "Faixa não encontrada");
  const mergedBody = body.audioUrl === undefined || body.audioUrl === "" ? { ...body, audioUrl: current.audioUrl } : body;
  const data = await trackData(mergedBody);
  const update: Prisma.TrackUncheckedUpdateInput = { ...data };
  const optionalFields = ["mbid", "discNumber", "bitrate", "sampleRate", "status", "statusNote", "lyricsLrc", "lyricsPlain"] as const;
  for (const field of optionalFields) if (body[field] === undefined) delete update[field];
  if (body.lyricsLrc === undefined && body.lyricsPlain === undefined) delete update.hasLyrics;
  else update.hasLyrics = !!((body.lyricsLrc === undefined ? current.lyricsLrc : data.lyricsLrc) || (body.lyricsPlain === undefined ? current.lyricsPlain : data.lyricsPlain));
  return { data, update };
}
