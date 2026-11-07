import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { musicJson, musicError, adminDenied, fail, readBody, id } from "@/lib/music/http";
import { albumData } from "@/lib/music/admin-input";

export async function GET(req: Request, ctx: { params: Promise<{ albumId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const albumId = id((await ctx.params).albumId, "albumId");
    const album = await prisma.album.findUnique({ where: { id: albumId }, include: { artist: true } });
    if (!album) fail(404, "Registro não encontrado");
    return musicJson({ album });
  } catch (error) { return musicError(error); }
}

export async function PUT(req: Request, ctx: { params: Promise<{ albumId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const albumId = id((await ctx.params).albumId, "albumId");
    const data = albumData(await readBody(req));
    if (!await prisma.artist.findUnique({ where: { id: data.artistId } })) fail(400, "Artista inexistente");
    if (await prisma.track.count({ where: { albumId, artistId: { not: data.artistId } } })) fail(409, "Álbum possui faixas de outro artista");
    const album = await prisma.album.update({ where: { id: albumId }, data, include: { artist: true } });
    return musicJson({ album });
  } catch (error) { return musicError(error); }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ albumId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const albumId = id((await ctx.params).albumId, "albumId");
    await prisma.album.delete({ where: { id: albumId } });
    return musicJson({ ok: true });
  } catch (error) { return musicError(error); }
}

