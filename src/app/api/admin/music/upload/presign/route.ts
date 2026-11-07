import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { musicJson, musicError, adminDenied, fail, readBody, text, id, image } from "@/lib/music/http";
import { randomUUID } from "node:crypto";
import { musicKey, presignMusicPut } from "@/lib/music/storage";

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const body = await readBody(req);
    const kind = text(body.kind, "kind", 10, true);
    if (kind !== "audio" && kind !== "cover") fail(400, "kind inválido");
    const artistId = id(body.artistId, "artistId");
    const albumId = id(body.albumId, "albumId");
    const trackId = body.trackId === undefined ? undefined : id(body.trackId, "trackId");
    const filename = text(body.filename, "filename", 255, true);
    const contentType = text(body.contentType, "contentType", 100, true).toLowerCase();
    const audioTypes: Record<string, string[]> = { "audio/mpeg": ["mp3"], "audio/mp3": ["mp3"], "audio/flac": ["flac"], "audio/x-flac": ["flac"], "audio/wav": ["wav"], "audio/wave": ["wav"], "audio/x-wav": ["wav"], "audio/aac": ["aac"], "audio/mp4": ["m4a"], "audio/x-m4a": ["m4a"], "audio/ogg": ["ogg", "opus"], "audio/opus": ["opus"] };
    const imageTypes: Record<string, string[]> = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "image/gif": ["gif"] };
    const types = kind === "audio" ? audioTypes : imageTypes;
    if (!Object.prototype.hasOwnProperty.call(types, contentType)) fail(400, "contentType inválido");
    const extensions = types[contentType];
    if (!extensions) fail(400, "contentType inválido");
    const safeName = filename.split(/[\\/]/).pop()!.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".").slice(-160);
    const ext = safeName.split(".").pop()?.toLowerCase();
    if (!ext || !extensions.includes(ext)) fail(400, "Extensão incompatível com contentType");
    const album = await prisma.album.findUnique({ where: { id: albumId }, select: { artistId: true } });
    if (!album || album.artistId !== artistId) fail(400, "Álbum e artista incompatíveis");
    if (trackId && !await prisma.track.findFirst({ where: { id: trackId, albumId, artistId } })) fail(400, "Faixa incompatível com o álbum");
    const objectId = trackId ?? randomUUID();
    const key = kind === "audio" ? musicKey(artistId, albumId, `${objectId}.${ext}`) : musicKey("covers", artistId, albumId, `${randomUUID()}-${safeName}`);
    return musicJson({ key, url: await presignMusicPut(key, contentType, 900) });
  } catch (error) { return musicError(error); }
}

