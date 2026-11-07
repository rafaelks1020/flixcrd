import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, fail, readBody, id } from "@/lib/music/http";
import { playlistInclude, playlistWhere, requirePlaylist, playlistData } from "@/lib/music/playlists";

export async function GET(req: Request, ctx: { params: Promise<{ playlistId: string }> }) {
  try {
    const user = await requireMusicAccess();
    const playlistId = id((await ctx.params).playlistId, "playlistId");
    await requirePlaylist(playlistId, user.userId);
    const playlist = await prisma.playlist.findFirst({ where: playlistWhere(playlistId, user.userId), include: playlistInclude });
    if (!playlist) fail(404, "Playlist não encontrada");
    const canEdit = playlist.userId === user.userId || playlist.collaborators.some(c => c.userId === user.userId && c.role === "editor");
    return musicJson({ ...playlist, canEdit });
  } catch (error) { return musicError(error); }
}

export async function PUT(req: Request, ctx: { params: Promise<{ playlistId: string }> }) {
  try {
    const user = await requireMusicAccess();
    const playlistId = id((await ctx.params).playlistId, "playlistId");
    await requirePlaylist(playlistId, user.userId, true);
    const data = playlistData(await readBody(req), true);
    const playlist = await prisma.playlist.update({ where: { id: playlistId, AND: playlistWhere(playlistId, user.userId, true) }, data, include: playlistInclude });
    return musicJson({ playlist });
  } catch (error) { return musicError(error); }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ playlistId: string }> }) {
  try {
    const user = await requireMusicAccess();
    const playlistId = id((await ctx.params).playlistId, "playlistId");
    await requirePlaylist(playlistId, user.userId, true, true);
    await prisma.playlist.delete({ where: { id: playlistId, userId: user.userId } });
    return musicJson({ success: true });
  } catch (error) { return musicError(error); }
}

