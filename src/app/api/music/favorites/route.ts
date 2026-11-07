import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, fail, readBody, id, limitFrom } from "@/lib/music/http";
import { trackInclude, presentTrack } from "@/lib/music/catalog-db";

export async function GET(req: Request) {
  try {
    const user = await requireMusicAccess();
    const params = new URL(req.url).searchParams;
    if (params.has("trackId")) {
      const trackId = id(params.get("trackId"), "trackId");
      return musicJson({ isFavorite: !!await prisma.musicFavorite.findUnique({ where: { userId_trackId: { userId: user.userId, trackId } } }) });
    }
    const favorites = await prisma.musicFavorite.findMany({ where: { userId: user.userId }, include: { track: { include: trackInclude } }, take: limitFrom(req, 100), orderBy: { addedAt: "desc" } });
    return musicJson({ favorites: await Promise.all(favorites.map(async f => ({ ...f, track: await presentTrack(f.track) }))), count: favorites.length });
  } catch (error) { return musicError(error); }
}

export async function POST(req: Request) {
  try {
    const user = await requireMusicAccess();
    const body = await readBody(req);
    const trackId = id(body.trackId, "trackId");
    if (!await prisma.track.findFirst({ where: { id: trackId, status: "READY" } })) fail(404, "Faixa não encontrada");
    await prisma.musicFavorite.upsert({ where: { userId_trackId: { userId: user.userId, trackId } }, create: { userId: user.userId, trackId }, update: {} });
    return musicJson({ isFavorite: true });
  } catch (error) { return musicError(error); }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireMusicAccess();
    const trackId = id(new URL(req.url).searchParams.get("trackId"), "trackId");
    await prisma.musicFavorite.deleteMany({ where: { userId: user.userId, trackId } });
    return musicJson({ isFavorite: false });
  } catch (error) { return musicError(error); }
}

