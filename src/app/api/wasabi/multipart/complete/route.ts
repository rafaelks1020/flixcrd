import { NextRequest, NextResponse } from "next/server";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

import { wasabiClient } from "@/lib/wasabi";

const bucketName = process.env.WASABI_BUCKET_NAME;

interface CompletePartInput {
  partNumber: number;
  eTag: string;
}

export async function POST(request: NextRequest) {
  if (!bucketName) {
    return NextResponse.json(
      { error: "WASABI_BUCKET_NAME não configurado" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { key, uploadId, parts } = body ?? {};

    if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json(
        { error: "Campos obrigatórios: key, uploadId, parts[]" },
        { status: 400 },
      );
    }

    const normalizedParts = (parts as CompletePartInput[])
      .map((p) => ({
        ETag: p.eTag,
        PartNumber: Number(p.partNumber),
      }))
      .filter((p) => Number.isFinite(p.PartNumber) && p.PartNumber > 0)
      .sort((a, b) => a.PartNumber - b.PartNumber);

    if (normalizedParts.length === 0) {
      return NextResponse.json(
        { error: "Lista de partes inválida" },
        { status: 400 },
      );
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: normalizedParts,
      },
    });

    const response = await wasabiClient.send(command);

    return NextResponse.json({
      location: response.Location ?? null,
      bucket: response.Bucket ?? null,
      key: response.Key ?? key,
    });
  } catch (error) {
    console.error("POST /api/wasabi/multipart/complete error", error);
    return NextResponse.json(
      { error: "Erro ao finalizar upload multipart no Wasabi" },
      { status: 500 },
    );
  }
}
