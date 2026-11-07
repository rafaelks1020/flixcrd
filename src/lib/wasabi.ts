import { storageEnv } from "@/lib/storage-config";
import { S3Client } from "@aws-sdk/client-s3";

const accessKeyId = storageEnv.accessKeyId;
const secretAccessKey = storageEnv.secretAccessKey;
const endpoint = storageEnv.endpoint;
const region = storageEnv.region ?? "us-east-1";

if (!accessKeyId || !secretAccessKey || !endpoint) {
  // Em ambiente de build/rodando sem credenciais, apenas logamos.
  console.warn("Wasabi S3 credentials or endpoint not configured.");
}

export const wasabiClient = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials:
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined,
});
