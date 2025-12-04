import { NextRequest, NextResponse } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { b2Client } from "@/lib/b2";

const bucketName = process.env.B2_BUCKET;

export async function POST(request: NextRequest) {
  if (!bucketName) {
      return NextResponse.json(
        { error: "B2_BUCKET não configurado" },
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

    const uploadUrl = await getSignedUrl(b2Client, command, {
      expiresIn: 60 * 30,
    });

    console.log(`[B2 Upload Part] Generated URL for part ${partNum} of ${key}`);

    return NextResponse.json({ uploadUrl });
  } catch (error) {
    console.error("POST /api/wasabi/multipart/part-url error", error);
    return NextResponse.json(
      { error: "Erro ao gerar URL de parte para B2" },
      { status: 500 },
    );
  }
}
