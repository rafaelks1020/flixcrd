import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { storageEnv } from "@/lib/storage-config";
import { wasabiClient } from "@/lib/wasabi";

const SIGNED_URL_EXPIRES_IN = 21600;
const PRIVATE_PLAYLIST_MAX_AGE = 300;

const SEGMENT_EXTENSIONS = [".ts", ".m4s", ".aac", ".vtt", ".key"];

export function isHlsSegmentReference(reference: string): boolean {
  const lower = reference.toLowerCase();
  return SEGMENT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function playlistCacheControl(): string {
  if (storageEnv.cdnUrl) {
    return "public, max-age=300, stale-while-revalidate=60";
  }
  return `private, max-age=${PRIVATE_PLAYLIST_MAX_AGE}`;
}

function requireBucket(): string {
  const bucket = storageEnv.bucket;
  if (!bucket) {
    throw new Error("Bucket de storage não configurado.");
  }
  return bucket;
}

export async function publicOrSignedUrl(key: string, expiresIn = SIGNED_URL_EXPIRES_IN): Promise<string> {
  const cdnUrl = storageEnv.cdnUrl;
  if (cdnUrl) {
    return `${cdnUrl}${key}`;
  }

  return getSignedUrl(
    wasabiClient,
    new GetObjectCommand({
      Bucket: requireBucket(),
      Key: key,
    }),
    { expiresIn },
  );
}

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  if (record.name === "NoSuchKey" || record.Code === "NoSuchKey") return true;
  return record.$metadata?.httpStatusCode === 404;
}

export async function readObjectText(key: string): Promise<string | null> {
  const cdnUrl = storageEnv.cdnUrl;
  if (cdnUrl) {
    const response = await fetch(`${cdnUrl}${key}`, {
      cache: "default",
      headers: {
        Accept: "application/vnd.apple.mpegurl, */*",
      },
    });
    if (!response.ok) return null;
    return response.text();
  }

  try {
    const result = await wasabiClient.send(
      new GetObjectCommand({
        Bucket: requireBucket(),
        Key: key,
      }),
    );
    if (!result.Body) return null;
    return await result.Body.transformToString("utf-8");
  } catch (error) {
    if (isMissingObject(error)) return null;
    throw error;
  }
}
