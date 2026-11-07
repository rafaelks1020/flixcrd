import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { musicJson, musicError, adminDenied, fail, readBody, id } from "@/lib/music/http";
import { artistData } from "@/lib/music/admin-input";

export async function GET(req: Request, ctx: { params: Promise<{ artistId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const artistId = id((await ctx.params).artistId, "artistId");
    const artist = await prisma.artist.findUnique({ where: { id: artistId } });
    if (!artist) fail(404, "Registro não encontrado");
    return musicJson({ artist });
  } catch (error) { return musicError(error); }
}

export async function PUT(req: Request, ctx: { params: Promise<{ artistId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const artistId = id((await ctx.params).artistId, "artistId");
    const data = artistData(await readBody(req));
    const artist = await prisma.artist.update({ where: { id: artistId }, data });
    return musicJson({ artist });
  } catch (error) { return musicError(error); }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ artistId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const artistId = id((await ctx.params).artistId, "artistId");
    await prisma.artist.delete({ where: { id: artistId } });
    return musicJson({ ok: true });
  } catch (error) { return musicError(error); }
}

