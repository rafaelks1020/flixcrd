import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, text, boolean, image, type Body } from "./http";
import { trackInclude } from "./catalog-db";

export function playlistWhere(playlistId: string, userId: string, write = false): Prisma.PlaylistWhereInput {
  return { id: playlistId, OR: [
    { userId },
    { collaborators: { some: { userId, role: { in: write ? ["editor"] : ["editor", "viewer"] } } } },
    ...(write ? [] : [{ isPublic: true }]),
  ] };
}
export async function requirePlaylist(playlistId: string, userId: string, write = false, ownerOnly = false) {
  const playlist = await prisma.playlist.findFirst({ where: ownerOnly ? { id: playlistId, userId } : playlistWhere(playlistId, userId, write) });
  if (!playlist) fail(404, "Playlist não encontrada ou acesso negado");
  return playlist;
}
export const playlistInclude = {
  owner: { select: { id: true, name: true } },
  tracks: { include: { track: { include: trackInclude }, adder: { select: { id: true, name: true } } }, orderBy: { position: "asc" as const } },
  collaborators: { include: { user: { select: { id: true, name: true } } } },
  _count: { select: { tracks: true } },
} satisfies Prisma.PlaylistInclude;

export function playlistData(body: Body, partial = false) {
  return {
    ...(!partial || body.name !== undefined ? { name: text(body.name, "name", 200, true) } : {}),
    ...(!partial || body.description !== undefined ? { description: text(body.description, "description", 5000) || null } : {}),
    ...(!partial || body.coverUrl !== undefined ? { coverUrl: image(body.coverUrl, "coverUrl") || null } : {}),
    ...(!partial || body.isPublic !== undefined ? { isPublic: boolean(body.isPublic, "isPublic") } : {}),
    ...(!partial || body.isCollaborative !== undefined ? { isCollaborative: boolean(body.isCollaborative, "isCollaborative") } : {}),
  };
}
