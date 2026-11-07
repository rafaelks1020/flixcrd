import { requireAdmin } from "@/lib/require-admin";
import { musicJson, musicError, adminDenied, fail, readBody, text, boolean } from "@/lib/music/http";
import { enrichArtistByName, enrichReleaseGroupByTitle } from "@/lib/music/musicbrainz";
import { importMusicImage } from "@/lib/music/import-image";

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth) return adminDenied();
    const body = await readBody(req);
    const entity = text(body.entity, "entity", 20, true);
    const importImages = boolean(body.importImages, "importImages", true);
    let result;
    if (entity === "artist") result = await enrichArtistByName(text(body.name, "name", 300, true));
    else if (entity === "album") result = await enrichReleaseGroupByTitle({ title: text(body.title, "title", 300, true), artistName: text(body.artistName, "artistName", 300) || null });
    else fail(400, "Entidade inválida");
    if (!result) fail(404, "Metadados não encontrados");
    const source = entity === "artist" ? result.imageSourceUrls?.picture : result.imageSourceUrls?.cover;
    const key = importImages && source ? await importMusicImage(source, entity, result.mbid) : null;
    return musicJson({ ok: true, result: { ...result, imageStorageUris: entity === "artist" ? { picture: key } : { cover: key } } });
  } catch (error) { return musicError(error); }
}

