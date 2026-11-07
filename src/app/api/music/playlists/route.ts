import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, readBody, limitFrom } from "@/lib/music/http";
import { playlistInclude, playlistData } from "@/lib/music/playlists";

export async function GET(req: Request) {
  try {
    const user = await requireMusicAccess();
    const includePublic = new URL(req.url).searchParams.get("public") === "true";
    const playlists = await prisma.playlist.findMany({ where: { OR: [{ userId: user.userId }, { collaborators: { some: { userId: user.userId, role: { in: ["editor", "viewer"] } } } }, ...(includePublic ? [{ isPublic: true }] : [])] }, include: playlistInclude, take: limitFrom(req, 50), orderBy: { updatedAt: "desc" } });
    return musicJson({ playlists });
  } catch (error) { return musicError(error); }
}

export async function POST(req: Request) {
  try {
    const user = await requireMusicAccess();
    const body = await readBody(req);
    const data = playlistData(body);
    const playlist = await prisma.playlist.create({ data: { ...data, name: data.name!, userId: user.userId, collaborators: { create: { userId: user.userId, role: "owner" } } }, include: playlistInclude });
    return musicJson({ playlist }, 201);
  } catch (error) { return musicError(error); }
}

