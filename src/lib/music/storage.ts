import { storageEnv } from "@/lib/storage-config";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { wasabiClient } from "@/lib/wasabi";
import { MusicError } from "./errors";

export function assertMusicKey(key: string): void {
  if (typeof key !== "string" || !key.startsWith("music/") || key.length <= 6 || key.length > 1024 || key.includes("..") || key.includes("\\") || key.includes("//") || /[%\s\x00-\x1f]/.test(key) || key.split("/").includes(".")) {
    throw new MusicError(400, "Chave de música inválida");
  }
}

export function musicKey(...parts: string[]): string {
  if (!parts.length || parts.some(part => !part || part.includes("/"))) throw new MusicError(400, "Segmento de chave inválido");
  const key = `music/${parts.join("/")}`;
  assertMusicKey(key);
  return key;
}

export function musicBucket(): string {
  const bucket = storageEnv.bucket;
  if (!bucket) throw new MusicError(503, "Storage não configurado");
  return bucket;
}
export async function presignMusicGet(key: string, expiresIn = 3600): Promise<string> {
  assertMusicKey(key);
  return getSignedUrl(wasabiClient, new GetObjectCommand({ Bucket: musicBucket(), Key: key }), { expiresIn });
}
export async function presignMusicPut(key: string, contentType: string, expiresIn = 900): Promise<string> {
  assertMusicKey(key);
  return getSignedUrl(wasabiClient, new PutObjectCommand({ Bucket: musicBucket(), Key: key, ContentType: contentType }), { expiresIn });
}
