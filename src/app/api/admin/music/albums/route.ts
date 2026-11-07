import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { musicJson, musicError, adminDenied, fail, readBody, id, limitFrom } from "@/lib/music/http";
import { albumData } from "@/lib/music/admin-input";

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const albums = await prisma.album.findMany({ take: limitFrom(req, 100, 500), orderBy: { createdAt: "desc" }, include: { artist: true } });
    return musicJson({ albums });
  } catch (error) { return musicError(error); }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const data = albumData(await readBody(req));
    if (!await prisma.artist.findUnique({ where: { id: data.artistId } })) fail(400, "Artista inexistente");
    const album = await prisma.album.create({ data, include: { artist: true } });
    return musicJson({ album }, 201);
  } catch (error) { return musicError(error); }
}

