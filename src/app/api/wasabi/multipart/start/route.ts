import { NextRequest, NextResponse } from "next/server";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
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
    const { titleId, episodeId, filename, contentType } = body ?? {};

    if (!filename || (!titleId && !episodeId)) {
      return NextResponse.json(
        { error: "Campos obrigatórios: filename e (titleId ou episodeId)" },
        { status: 400 },
      );
    }

    // Upload multipart para episódio específico
    if (episodeId) {
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: { title: true },
      });

      if (!episode || !episode.title) {
        return NextResponse.json(
          { error: "Episódio não encontrado" },
          { status: 404 },
        );
      }

      const title = episode.title as any;
      const safeSlug = title.slug || `title-${title.id}`;

      let prefix: string;
      if (episode.hlsPath && episode.hlsPath.trim() !== "") {
        prefix = episode.hlsPath.endsWith("/")
          ? episode.hlsPath
          : `${episode.hlsPath}/`;
      } else if (episode.seasonNumber && episode.episodeNumber) {
        const s = episode.seasonNumber.toString().padStart(2, "0");
        const e = episode.episodeNumber.toString().padStart(2, "0");
        prefix = `titles/${safeSlug}/s${s}/e${e}/`;
      } else {
        prefix = `titles/${safeSlug}/episodes/${episode.id}/`;
      }

      const key = `${prefix}${filename}`;

      const command = new CreateMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType || "application/octet-stream",
      });

      const response = await b2Client.send(command);

      if (!response.UploadId) {
        return NextResponse.json(
          { error: "Não foi possível iniciar upload multipart no B2" },
          { status: 500 },
        );
      }

      await prisma.episode.update({
        where: { id: episode.id },
        data: {
          hlsPath: prefix,
        },
      });

      return NextResponse.json({
        uploadId: response.UploadId,
        key,
        prefix,
      });
    }

    // Upload multipart no nível do título (filmes ou fluxo antigo)
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

    const response = await b2Client.send(command);

    if (!response.UploadId) {
      return NextResponse.json(
        { error: "Não foi possível iniciar upload multipart no B2" },
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
      { error: "Erro ao iniciar upload multipart no B2" },
      { status: 500 },
    );
  }
}
