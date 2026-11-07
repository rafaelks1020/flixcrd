import { PutObjectCommand } from "@aws-sdk/client-s3";
import { wasabiClient } from "@/lib/wasabi";
import { musicBucket, musicKey } from "./storage";

// Aceita somente provedores públicos de imagem conhecidos, inclusive nos redirecionamentos.
function allowedImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const host = url.hostname;
    const allowed = ["coverartarchive.org", "archive.org", "upload.wikimedia.org", "commons.wikimedia.org"];
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    if (!allowed.includes(host) && !host.endsWith(".archive.org")) return null;
    return url;
  } catch { return null; }
}
export async function importMusicImage(sourceUrl: string, entity: string, mbid: string): Promise<string | null> {
  try {
    let url = allowedImageUrl(sourceUrl);
    if (!url) return null;
    let response: Response | undefined;
    for (let i = 0; i < 4; i++) {
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000) });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      await response.body?.cancel();
      url = location ? allowedImageUrl(new URL(location, url).href) : null;
      if (!url) return null;
    }
    if (!response?.ok || !response.body) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[contentType];
    if (!ext || Number(response.headers.get("content-length")) > 12_000_000) { await response.body.cancel(); return null; }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 12_000_000) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    if (!total || !/^[a-zA-Z0-9-]+$/.test(mbid)) return null;
    const key = musicKey("covers", "musicbrainz", entity, `${mbid}.${ext}`);
    await wasabiClient.send(new PutObjectCommand({ Bucket: musicBucket(), Key: key, Body: Buffer.concat(chunks), ContentType: contentType }));
    return key;
  } catch { return null; }
}
