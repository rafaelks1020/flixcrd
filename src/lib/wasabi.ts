import { S3Client } from "@aws-sdk/client-s3";

const accessKeyId = process.env.WASABI_ACCESS_KEY_ID;
const secretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY;
const endpoint = process.env.WASABI_ENDPOINT;
const region = process.env.WASABI_REGION ?? "us-east-1";

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
