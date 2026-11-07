import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, fail, readBody, text, id, number, boolean, limitFrom } from "@/lib/music/http";
import { trackInclude, presentTrack } from "@/lib/music/catalog-db";

export async function GET(req: Request) {
  try {
    const user = await requireMusicAccess();
    const history = await prisma.musicPlayHistory.findMany({ where: { userId: user.userId }, include: { track: { include: trackInclude } }, take: limitFrom(req, 50), distinct: ["trackId"], orderBy: { playedAt: "desc" } });
    return musicJson({ history: await Promise.all(history.map(async h => ({ ...h, track: await presentTrack(h.track) }))), count: history.length });
  } catch (error) { return musicError(error); }
}

export async function POST(req: Request) {
  try {
    const user = await requireMusicAccess();
    const body = await readBody(req);
    const trackId = id(body.trackId, "trackId");
    const durationSec = number(body.durationSec, "durationSec", 0, 604800, 0);
    const completed = boolean(body.completed, "completed");
    const source = text(body.source, "source", 100) || null;
    const entry = await prisma.$transaction(async tx => {
      const track = await tx.track.findFirst({ where: { id: trackId, status: "READY" } });
      if (!track) fail(404, "Faixa não encontrada");
      const result = await tx.musicPlayHistory.create({ data: { userId: user.userId, trackId, durationSec, completed, source } });
      await tx.track.update({ where: { id: trackId }, data: { playCount: { increment: 1 } } });
      return result;
    });
    return musicJson({ id: entry.id, message: "Reprodução registrada" }, 201);
  } catch (error) { return musicError(error); }
}

