import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, fail, id } from "@/lib/music/http";
import { getTracksForAlbum } from "@/lib/music/catalog-db";

export async function GET(req: Request) {
  try {
    await requireMusicAccess();
    const trackId = id(new URL(req.url).searchParams.get("trackId"), "trackId");
    const track = await prisma.track.findFirst({ where: { id: trackId, status: "READY" }, select: { albumId: true } });
    if (!track) fail(404, "Faixa não encontrada");
    const tracks = await getTracksForAlbum(track.albumId);
    return musicJson({ startIndex: Math.max(0, tracks.findIndex(t => t.id === trackId)), tracks });
  } catch (error) { return musicError(error); }
}

