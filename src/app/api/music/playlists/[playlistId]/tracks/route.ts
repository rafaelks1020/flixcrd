import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, fail, readBody, id, number, limitFrom } from "@/lib/music/http";
import { playlistWhere, requirePlaylist } from "@/lib/music/playlists";
import { trackInclude } from "@/lib/music/catalog-db";

export async function GET(req: Request, ctx: { params: Promise<{ playlistId: string }> }) {
  try {
    const user = await requireMusicAccess();
    const playlistId = id((await ctx.params).playlistId, "playlistId");
    await requirePlaylist(playlistId, user.userId);
    const tracks = await prisma.playlistTrack.findMany({ where: { playlistId, playlist: playlistWhere(playlistId, user.userId) }, include: { track: { include: trackInclude } }, orderBy: { position: "asc" }, take: limitFrom(req, 100, 500) });
    return musicJson({ tracks });
  } catch (error) { return musicError(error); }
}

export async function POST(req: Request, ctx: { params: Promise<{ playlistId: string }> }) {
  try {
    const user = await requireMusicAccess();
    const playlistId = id((await ctx.params).playlistId, "playlistId");
    await requirePlaylist(playlistId, user.userId, true);
    const body = await readBody(req);
    const trackId = id(body.trackId, "trackId");
    if (body.position !== undefined && (typeof body.position !== "number" || !Number.isFinite(body.position) || Math.abs(body.position) > 1e12)) fail(400, "position inválido");
    if (!await prisma.track.findFirst({ where: { id: trackId, status: "READY" } })) fail(404, "Faixa não encontrada");
    const last = await prisma.playlistTrack.findFirst({ where: { playlistId }, orderBy: { position: "desc" } });
    const position = typeof body.position === "number" ? body.position : (last?.position ?? 0) + 1;
    const track = await prisma.playlistTrack.create({ data: { playlistId, trackId, addedBy: user.userId, position }, include: { track: { include: trackInclude } } });
    return musicJson({ track }, 201);
  } catch (error) { return musicError(error); }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ playlistId: string }> }) {
  try {
    const user = await requireMusicAccess();
    const playlistId = id((await ctx.params).playlistId, "playlistId");
    await requirePlaylist(playlistId, user.userId, true);
    const trackId = id(new URL(req.url).searchParams.get("trackId"), "trackId");
    await prisma.playlistTrack.deleteMany({ where: { playlistId, trackId, playlist: playlistWhere(playlistId, user.userId, true) } });
    return musicJson({ success: true });
  } catch (error) { return musicError(error); }
}

