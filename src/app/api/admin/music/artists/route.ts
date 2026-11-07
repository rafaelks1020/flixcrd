import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { musicJson, musicError, adminDenied, readBody, limitFrom } from "@/lib/music/http";
import { artistData } from "@/lib/music/admin-input";

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const artists = await prisma.artist.findMany({ take: limitFrom(req, 100, 500), orderBy: { createdAt: "desc" } });
    return musicJson({ artists });
  } catch (error) { return musicError(error); }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const data = artistData(await readBody(req));
    const artist = await prisma.artist.create({ data });
    return musicJson({ artist }, 201);
  } catch (error) { return musicError(error); }
}

