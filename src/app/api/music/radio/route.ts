import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, id, limitFrom } from "@/lib/music/http";
import { trackInclude, presentTrack } from "@/lib/music/catalog-db";

export async function GET(req: Request) {
  try {
    await requireMusicAccess();
    const params = new URL(req.url).searchParams;
    const seedId = params.has("trackId") ? id(params.get("trackId"), "trackId") : undefined;
    const limit = limitFrom(req, 12, 30);
    const seed = seedId ? await prisma.track.findFirst({ where: { id: seedId, status: "READY" } }) : null;
    let tracks = seed ? await prisma.track.findMany({
      where: { status: "READY", id: { not: seed.id }, OR: [{ artistId: seed.artistId }, ...(seed.genres.length ? [{ genres: { hasSome: seed.genres } }] : [])] },
      include: trackInclude, take: limit, orderBy: [{ ratingScore: "desc" }, { playCount: "desc" }],
    }) : [];
    if (!tracks.length) tracks = await prisma.track.findMany({ where: { status: "READY", ...(seedId ? { id: { not: seedId } } : {}) }, include: trackInclude, take: limit, orderBy: [{ ratingScore: "desc" }, { playCount: "desc" }] });
    return musicJson({ tracks: await Promise.all(tracks.map(async t => ({ ...await presentTrack(t), source: "radio" }))) });
  } catch (error) { return musicError(error); }
}

