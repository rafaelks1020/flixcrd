import { S3Client } from "@aws-sdk/client-s3";

const accessKeyId = process.env.B2_KEY_ID;
const secretAccessKey = process.env.B2_SECRET;
// B2 S3-compatible endpoint
const endpoint = "https://s3.us-east-005.backblazeb2.com";
// B2 precisa de uma região genérica
const region = "us-east-005";

if (!accessKeyId || !secretAccessKey) {
  console.warn("Backblaze B2 credentials not configured.");
}

export const b2Client = new S3Client({
  region,
  endpoint,
  // B2 requer path-style para funcionar corretamente com S3 SDK
  forcePathStyle: true,
  credentials:
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined,
});
