import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

/**
 * Instancia cliente S3 compativel com Wasabi, R2, MinIO e AWS S3.
 */
export function createStorageClient(s3Config) {
  return new S3Client({
    region: s3Config.region || "us-east-1",
    endpoint: s3Config.endpoint,
    forcePathStyle: true,
    credentials:
      s3Config.accessKeyId && s3Config.secretAccessKey
        ? {
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
          }
        : undefined,
  });
}

export function contentTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".m3u8":
      return "application/vnd.apple.mpegurl";
    case ".ts":
      return "video/mp2t";
    case ".vtt":
      return "text/vtt; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

/**
 * Baixa objeto do bucket via stream direto para arquivo em disco.
 */
export async function downloadObjectToFile({ s3, bucket, key, destPath, signal, onProgress }) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    signal ? { abortSignal: signal } : undefined,
  );

  if (!response.Body) {
    throw new Error(`Objeto vazio ou sem corpo retornado do S3: ${key}`);
  }

  const totalBytes = Number(response.ContentLength ?? 0);
  let downloadedBytes = 0;

  const progressStream = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length;
      if (onProgress) {
        onProgress(totalBytes > 0 ? downloadedBytes / totalBytes : null, downloadedBytes, totalBytes);
      }
      callback(null, chunk);
    },
  });

  await pipeline(
    response.Body,
    progressStream,
    fs.createWriteStream(destPath),
    signal ? { signal } : undefined,
  );
}

/**
 * Envia um arquivo local para o bucket S3 usando Upload multipart automatico quando grande.
 */
export async function uploadFileToS3({ s3, bucket, key, filePath, signal, onBytes }) {
  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentTypeForFile(filePath),
    },
    queueSize: 3,
    partSize: 16 * 1024 * 1024,
    leavePartsOnError: false,
  });

  if (onBytes) {
    uploader.on("httpUploadProgress", (progress) => {
      if (typeof progress?.loaded === "number") onBytes(progress.loaded);
    });
  }

  if (signal) {
    if (signal.aborted) {
      await uploader.abort().catch(() => {});
      throw new Error("Upload abortado.");
    }
    const onAbort = () => {
      uploader.abort().catch(() => {});
    };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      await uploader.done();
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
    return;
  }

  await uploader.done();
}

/**
 * Soma o tamanho em bytes de uma lista de arquivos (retorna mapa nome -> bytes e o total).
 */
export async function sumFileSizes(dir, fileNames) {
  const sizes = new Map();
  let total = 0;
  for (const name of fileNames) {
    const st = await fsPromises.stat(path.join(dir, name));
    sizes.set(name, st.size);
    total += st.size;
  }
  return { sizes, total };
}

/**
 * Remove objeto do bucket S3.
 */
export async function deleteObjectFromS3({ s3, bucket, key, signal }) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    signal ? { abortSignal: signal } : undefined,
  );
}
