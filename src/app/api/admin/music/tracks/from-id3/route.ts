import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { musicJson, musicError, adminDenied, fail, readBody, text, id, number, image } from "@/lib/music/http";
import { trackFields } from "@/lib/music/admin-input";

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const body = await readBody(req);
    const fields = trackFields(body, true);
    const artistName = text(body.artistName, "artistName", 300, true);
    const albumName = text(body.albumName, "albumName", 300, true);
    const year = number(body.year, "year", 1, 9999, new Date().getFullYear());
    const coverUrl = image(body.coverUrl, "coverUrl");
    const result = await prisma.$transaction(async tx => {
      let artist = await tx.artist.findFirst({ where: { name: { equals: artistName, mode: "insensitive" } } });
      const artistCreated = !artist;
      if (!artist) artist = await tx.artist.create({ data: { name: artistName, pictureUrl: "https://picsum.photos/seed/artist-default/320/320", genres: fields.genres } });
      let album = await tx.album.findFirst({ where: { artistId: artist.id, title: { equals: albumName, mode: "insensitive" } } });
      const albumCreated = !album;
      if (!album) album = await tx.album.create({ data: { title: albumName, artistId: artist.id, year, coverUrl: coverUrl || "https://picsum.photos/seed/album-default/800/800", genres: fields.genres, tags: [] } });
      else if (coverUrl && album.coverUrl.includes("picsum.photos")) album = await tx.album.update({ where: { id: album.id }, data: { coverUrl } });
      const duplicate = await tx.track.findFirst({ where: { albumId: album.id, OR: [{ audioUrl: fields.audioUrl }, { title: { equals: fields.title, mode: "insensitive" } }, ...(fields.trackNumber !== null ? [{ trackNumber: fields.trackNumber }] : [])] } });
      if (duplicate) fail(409, "Faixa já existe neste álbum");
      const track = await tx.track.create({ data: { ...fields, artistId: artist.id, albumId: album.id }, include: { artist: true, album: true } });
      return { track, artist, album, created: { artist: artistCreated, album: albumCreated } };
    });
    return musicJson(result, 201);
  } catch (error) { return musicError(error); }
}

