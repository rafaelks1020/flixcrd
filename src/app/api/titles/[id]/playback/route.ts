import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";
import { authOptions } from "@/lib/auth";

const bucketName = process.env.WASABI_BUCKET_NAME;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 },
      );
    }

    if (!bucketName) {
      return NextResponse.json(
        { error: "WASABI_BUCKET_NAME não configurado." },
        { status: 500 },
      );
    }

    const { id } = await context.params;

    const title = await prisma.title.findUnique({ where: { id } });

    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    if (!title.hlsPath) {
      return NextResponse.json(
        { error: "Título não possui caminho HLS configurado." },
        { status: 400 },
      );
    }

    const prefix = title.hlsPath.endsWith("/")
      ? title.hlsPath
      : `${title.hlsPath}/`;

    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const listed = await wasabiClient.send(listCommand);

    if (!listed.Contents || listed.Contents.length === 0) {
      return NextResponse.json(
        { error: "Nenhum arquivo encontrado no prefixo HLS deste título." },
        { status: 404 },
      );
    }

    const objects = listed.Contents.filter((obj) => obj.Key);

    const hlsObject = objects.find((obj) =>
      (obj.Key as string).toLowerCase().endsWith(".m3u8"),
    );

    const mp4Object = objects.find((obj) =>
      /\.(mp4|m4v|mov|mkv|webm)$/i.test(obj.Key as string),
    );

    const subtitleObjects = objects.filter((obj) =>
      (obj.Key as string).toLowerCase().endsWith(".vtt"),
    );

    let playbackKey: string | null = null;
    let kind: "hls" | "mp4";

    if (hlsObject && hlsObject.Key) {
      playbackKey = hlsObject.Key as string;
      kind = "hls";
    } else if (mp4Object && mp4Object.Key) {
      playbackKey = mp4Object.Key as string;
      kind = "mp4";
    } else {
      return NextResponse.json(
        {
          error:
            "Nenhum arquivo HLS (.m3u8) ou MP4 encontrado no prefixo HLS deste título.",
        },
        { status: 400 },
      );
    }

    let playbackUrl: string;

    if (kind === "hls") {
      // Para HLS, usamos uma rota interna que lê o master.m3u8 do Wasabi,
      // reescreve os segmentos com URLs assinadas e devolve o playlist.
      // Assim, apenas o .m3u8 passa pela Vercel; os .ts vão direto para o Wasabi.
      playbackUrl = `/api/titles/${title.id}/hls`;
    } else {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: playbackKey,
      });

      playbackUrl = await getSignedUrl(wasabiClient, command, {
        expiresIn: 60 * 5,
      });
    }

    const subtitles = await Promise.all(
      subtitleObjects.map(async (obj) => {
        const key = obj.Key as string;
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        });

        const url = await getSignedUrl(wasabiClient, command, {
          expiresIn: 60 * 60,
        });

        const filename = key.split("/").pop() ?? "Legenda";
        const base = filename.replace(/\.vtt$/i, "");

        let language: string | null = null;
        let label = base;

        const lower = base.toLowerCase();
        if (lower.includes("pt")) {
          language = "pt-BR";
        } else if (lower.includes("en")) {
          language = "en";
        }

        return {
          label,
          language,
          url,
        };
      }),
    );

    return NextResponse.json({
      playbackUrl,
      kind,
      subtitles,
      title: {
        id: title.id,
        name: title.name,
        originalName: title.originalName,
        overview: title.overview,
        releaseDate: title.releaseDate,
        posterUrl: title.posterUrl,
        backdropUrl: title.backdropUrl,
        type: title.type,
      },
    });
  } catch (error) {
    console.error("GET /api/titles/[id]/playback error", error);
    return NextResponse.json(
      { error: "Erro ao gerar URL de playback." },
      { status: 500 },
    );
  }
}
