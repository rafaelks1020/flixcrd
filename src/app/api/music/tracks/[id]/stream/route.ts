import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicError, fail, id } from "@/lib/music/http";
import { assertMusicKey, presignMusicGet } from "@/lib/music/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireMusicAccess();
    const trackId = id((await ctx.params).id);
    const track = await prisma.track.findFirst({ where: { id: trackId, status: "READY" }, select: { audioUrl: true } });
    if (!track) fail(404, "Faixa não encontrada");
    assertMusicKey(track.audioUrl);
    return new Response(null, { status: 302, headers: { Location: await presignMusicGet(track.audioUrl, 3600), "Cache-Control": "private, no-store" } });
  } catch (error) { return musicError(error); }
}

