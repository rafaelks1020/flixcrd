import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
    const { titleId, episodeId, filename, contentType } = body ?? {};

    if (!filename || (!titleId && !episodeId)) {
      return NextResponse.json(
        { error: "Campos obrigatórios: filename e (titleId ou episodeId)" },
        { status: 400 },
      );
    }

    // Upload para episódio específico (séries/animes)
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

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType || "application/octet-stream",
      });

      const uploadUrl = await getSignedUrl(wasabiClient, command, {
        expiresIn: 60 * 15,
      });

      await prisma.episode.update({
        where: { id: episode.id },
        data: {
          hlsPath: prefix,
        },
      });

      return NextResponse.json({ uploadUrl, key, prefix });
    }

    // Upload no nível do título (filmes ou fluxo antigo)
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

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(wasabiClient, command, {
      expiresIn: 60 * 15,
    });

    await prisma.title.update({
      where: { id: title.id },
      data: {
        hlsPath: prefix,
      },
    });

    return NextResponse.json({ uploadUrl, key, prefix });
  } catch (error) {
    console.error("POST /api/wasabi/upload-url error", error);
    return NextResponse.json(
      { error: "Erro ao gerar URL de upload para Wasabi" },
      { status: 500 },
    );
  }
}
