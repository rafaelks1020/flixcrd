import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, id, number, limitFrom } from "@/lib/music/http";
import { trackInclude, presentTrack } from "@/lib/music/catalog-db";

export async function GET(req: Request) {
  try {
    const user = await requireMusicAccess();
    const limit = limitFrom(req, 20, 50);
    const history = await prisma.musicPlayHistory.findMany({ where: { userId: user.userId }, include: { track: { select: { genres: true, artistId: true } } }, take: 50, orderBy: { playedAt: "desc" } });
    const genreCount: Record<string, number> = {};
    const artistCount: Record<string, number> = {};
    for (const h of history) {
      for (const genre of h.track.genres) genreCount[genre] = (genreCount[genre] ?? 0) + 1;
      artistCount[h.track.artistId] = (artistCount[h.track.artistId] ?? 0) + 1;
    }
    const topGenres = Object.keys(genreCount).sort((a, b) => genreCount[b] - genreCount[a]).slice(0, 5);
    const topArtists = Object.keys(artistCount).sort((a, b) => artistCount[b] - artistCount[a]).slice(0, 5);
    const heard = history.map(h => h.trackId);
    const recommendations = await prisma.track.findMany({ where: { status: "READY", id: { notIn: heard }, OR: [{ genres: { hasSome: topGenres } }, { artistId: { in: topArtists } }] }, include: trackInclude, take: limit, orderBy: [{ ratingScore: "desc" }, { playCount: "desc" }] });
    if (recommendations.length < limit) recommendations.push(...await prisma.track.findMany({ where: { status: "READY", id: { notIn: [...heard, ...recommendations.map(t => t.id)] } }, include: trackInclude, take: limit - recommendations.length, orderBy: [{ playCount: "desc" }, { ratingScore: "desc" }] }));
    return musicJson({ recommendations: await Promise.all(recommendations.map(presentTrack)), basedOn: { genres: topGenres, artistCount: topArtists.length } });
  } catch (error) { return musicError(error); }
}

