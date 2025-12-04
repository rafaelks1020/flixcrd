import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { b2Client } from "@/lib/b2";

const B2_CLOUDFLARE_BASE = process.env.B2_LINK; // https://hlspaelflix.top/b2/
const B2_BUCKET = process.env.B2_BUCKET;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 },
      );
    }

    if (!B2_CLOUDFLARE_BASE) {
      return NextResponse.json(
        { error: "B2_LINK não configurado." },
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

    const hlsPath = title.hlsPath?.endsWith("/") ? title.hlsPath : `${title.hlsPath}/`;
    const sourceParam = request.nextUrl.searchParams.get("source");

    // Tenta verificar se existe HLS no B2
    try {
      const listCmd = new ListObjectsV2Command({
        Bucket: B2_BUCKET,
        Prefix: hlsPath,
        MaxKeys: 10,
      });

      const listed = await b2Client.send(listCmd);
      const objects = listed.Contents?.filter((obj) => obj.Key) || [];

      // Procura por arquivo HLS (.m3u8)
      const hlsObject = objects.find((obj) =>
        (obj.Key as string).toLowerCase().endsWith(".m3u8"),
      );

      // Procura por arquivo de vídeo direto (.mp4, .mkv, etc)
      const videoObject = objects.find((obj) =>
        /\.(mp4|mkv|m4v|mov|webm|avi)$/i.test(obj.Key as string),
      );

      if (hlsObject) {
        // Tem HLS, usa ele
        const base = `/api/titles/${title.id}/hls`;
        const playbackUrl = sourceParam ? `${base}?source=${sourceParam}` : base;

        return NextResponse.json({
          playbackUrl,
          kind: "hls",
          subtitles: [],
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
      } else if (videoObject) {
        // Não tem HLS, mas tem vídeo direto
        const videoKey = videoObject.Key as string;
        const playbackUrl = `${B2_CLOUDFLARE_BASE}${videoKey}`;

        return NextResponse.json({
          playbackUrl,
          kind: "mp4",
          subtitles: [],
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
      } else {
        // Não tem nem HLS nem vídeo
        return NextResponse.json(
          { error: "Nenhum arquivo de vídeo encontrado para este título." },
          { status: 404 },
        );
      }
    } catch (listError) {
      console.error("Erro ao listar arquivos no B2:", listError);
      // Se der erro ao listar, tenta usar HLS mesmo assim
      const base = `/api/titles/${title.id}/hls`;
      const playbackUrl = sourceParam ? `${base}?source=${sourceParam}` : base;

      return NextResponse.json({
        playbackUrl,
        kind: "hls",
        subtitles: [],
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
    }

  } catch (error) {
    console.error("GET /api/titles/[id]/playback error", error);
    return NextResponse.json(
      { error: "Erro ao gerar URL de playback." },
      { status: 500 },
    );
  }
}
