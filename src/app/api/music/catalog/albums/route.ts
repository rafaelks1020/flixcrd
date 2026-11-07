import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, limitFrom } from "@/lib/music/http";
import { listAlbums } from "@/lib/music/catalog-db";

export async function GET(req: Request) {
  try {
    await requireMusicAccess();
    return musicJson({ albums: await listAlbums({ limit: limitFrom(req, 24, 60) }) });
  } catch (error) { return musicError(error); }
}

