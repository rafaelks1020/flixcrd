import { storageEnv } from "@/lib/storage-config";
import { NextRequest, NextResponse } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { wasabiClient } from "@/lib/wasabi";
import { adminDenied } from "@/lib/require-admin";
import { isUnsafeObjectKey } from "@/lib/object-key";

const bucketName = storageEnv.bucket;

export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;

  if (!bucketName) {
      return NextResponse.json(
        { error: "WASABI_BUCKET_NAME não configurado" },
        { status: 500 },
      );
  }

  try {
    const body = await request.json();
    const { key, uploadId, partNumber } = body ?? {};

    if (!key || !uploadId || !partNumber) {
      return NextResponse.json(
        { error: "Campos obrigatórios: key, uploadId, partNumber" },
        { status: 400 },
      );
    }

    if (typeof key !== "string" || isUnsafeObjectKey(key)) {
      return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
    }

    const partNum = Number(partNumber);

    if (!Number.isFinite(partNum) || partNum <= 0) {
      return NextResponse.json(
        { error: "partNumber inválido" },
        { status: 400 },
      );
    }

    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNum,
    });

    const uploadUrl = await getSignedUrl(wasabiClient, command, {
      expiresIn: 60 * 30,
    });

    console.log(`[Storage Upload Part] Generated URL for part ${partNum} of ${key}`);

    return NextResponse.json({ uploadUrl });
  } catch (error) {
    console.error("POST /api/wasabi/multipart/part-url error", error);
    return NextResponse.json(
      { error: "Erro ao gerar URL de parte no storage" },
      { status: 500 },
    );
  }
}
