import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { musicJson, musicError, adminDenied, fail, readBody, id } from "@/lib/music/http";
import { trackUpdateData } from "@/lib/music/admin-input";

export async function GET(req: Request, ctx: { params: Promise<{ trackId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const trackId = id((await ctx.params).trackId, "trackId");
    const track = await prisma.track.findUnique({ where: { id: trackId }, include: { artist: true, album: true } });
    if (!track) fail(404, "Registro não encontrado");
    return musicJson({ track });
  } catch (error) { return musicError(error); }
}

export async function PUT(req: Request, ctx: { params: Promise<{ trackId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const trackId = id((await ctx.params).trackId, "trackId");
    const { data, update } = await trackUpdateData(await readBody(req), trackId);
    const duplicate = await prisma.track.findFirst({ where: { id: { not: trackId }, albumId: data.albumId, OR: [{ audioUrl: data.audioUrl }, { title: { equals: data.title, mode: "insensitive" } }, ...(data.trackNumber !== null ? [{ trackNumber: data.trackNumber }] : [])] } });
    if (duplicate) return musicJson({ error: "Faixa duplicada", track: duplicate }, 409);
    const track = await prisma.track.update({ where: { id: trackId }, data: update, include: { artist: true, album: true } });
    return musicJson({ track });
  } catch (error) { return musicError(error); }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ trackId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const trackId = id((await ctx.params).trackId, "trackId");
    await prisma.track.delete({ where: { id: trackId } });
    return musicJson({ ok: true });
  } catch (error) { return musicError(error); }
}

