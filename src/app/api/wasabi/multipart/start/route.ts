import { NextRequest, NextResponse } from "next/server";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";

const bucketName = process.env.WASABI_BUCKET_NAME;

export async function POST(request: NextRequest) {
  if (!bucketName) {
    return NextResponse.json(
      { error: "WASABI_BUCKET_NAME não configurado" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { titleId, filename, contentType } = body ?? {};

    if (!titleId || !filename) {
      return NextResponse.json(
        { error: "Campos obrigatórios: titleId, filename" },
        { status: 400 },
      );
    }

    const title = await prisma.title.findUnique({ where: { id: titleId } });

    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado" },
        { status: 404 },
      );
    }

    const safeSlug = title.slug || `title-${title.id}`;
    const prefix = `titles/${safeSlug}/`;
    const key = `${prefix}${filename}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    const response = await wasabiClient.send(command);

    if (!response.UploadId) {
      return NextResponse.json(
        { error: "Não foi possível iniciar upload multipart no Wasabi" },
        { status: 500 },
      );
    }

    await prisma.title.update({
      where: { id: title.id },
      data: {
        hlsPath: prefix,
      },
    });

    return NextResponse.json({
      uploadId: response.UploadId,
      key,
      prefix,
    });
  } catch (error) {
    console.error("POST /api/wasabi/multipart/start error", error);
    return NextResponse.json(
      { error: "Erro ao iniciar upload multipart no Wasabi" },
      { status: 500 },
    );
  }
}
