import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { musicJson, musicError, adminDenied, readBody, text, limitFrom } from "@/lib/music/http";
import { trackData } from "@/lib/music/admin-input";

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const params = new URL(req.url).searchParams;
    const artist = text(params.get("artist"), "artist", 300);
    const album = text(params.get("album"), "album", 300);
    const title = text(params.get("title"), "title", 300);
    const tracks = await prisma.track.findMany({ where: { ...(title ? { title: { equals: title, mode: "insensitive" } } : {}), ...(artist ? { artist: { name: { equals: artist, mode: "insensitive" } } } : {}), ...(album ? { album: { title: { equals: album, mode: "insensitive" } } } : {}) }, take: limitFrom(req, 100, 500), orderBy: { createdAt: "desc" }, include: { artist: true, album: true } });
    return musicJson({ tracks });
  } catch (error) { return musicError(error); }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const data = await trackData(await readBody(req));
    const existing = await prisma.track.findFirst({ where: { albumId: data.albumId, OR: [{ audioUrl: data.audioUrl }, { title: { equals: data.title, mode: "insensitive" } }, ...(data.trackNumber !== null ? [{ trackNumber: data.trackNumber }] : [])] } });
    if (existing) return musicJson({ error: "Faixa duplicada", track: existing }, 409);
    const track = await prisma.track.create({ data, include: { artist: true, album: true } });
    return musicJson({ track }, 201);
  } catch (error) { return musicError(error); }
}

