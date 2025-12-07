import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";
import { wasabiClient } from "@/lib/wasabi";
import { generateStreamToken, isProtectedStreamingEnabled } from "@/lib/stream-token";

const WASABI_CDN_BASE = process.env.WASABI_CDN_URL; // URL do CDN
const WASABI_BUCKET = process.env.WASABI_BUCKET_NAME;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 },
      );
    }

    if (!WASABI_CDN_BASE) {
      return NextResponse.json(
        { error: "WASABI_CDN_URL não configurado." },
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

    // Tenta verificar se existe HLS no Wasabi
    try {
      const listCmd = new ListObjectsV2Command({
        Bucket: WASABI_BUCKET,
        Prefix: hlsPath,
        MaxKeys: 10,
      });

      const listed = await wasabiClient.send(listCmd);
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
        // Tem HLS - tentar usar streaming protegido
        let playbackUrl: string;
        let expiresAt: number | null = null;
        let isProtected = false;

        if (isProtectedStreamingEnabled() && title.hlsPath) {
          // Gerar token via Cloudflare Worker
          const cleanPath = title.hlsPath.endsWith("/") 
            ? title.hlsPath.slice(0, -1) 
            : title.hlsPath;
          
          const tokenData = await generateStreamToken(cleanPath, "wasabi");
          
          if (tokenData) {
            playbackUrl = tokenData.streamUrl;
            expiresAt = tokenData.expiresAt;
            isProtected = true;
          } else {
            // Fallback para API antiga
            const base = `/api/titles/${title.id}/hls`;
            playbackUrl = sourceParam ? `${base}?source=${sourceParam}` : base;
          }
        } else {
          // Streaming protegido não configurado, usa API antiga
          const base = `/api/titles/${title.id}/hls`;
          playbackUrl = sourceParam ? `${base}?source=${sourceParam}` : base;
        }

        return NextResponse.json({
          playbackUrl,
          kind: "hls",
          expiresAt,
          protected: isProtected,
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
        const playbackUrl = `${WASABI_CDN_BASE}${videoKey}`;

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
      console.error("Erro ao listar arquivos no Wasabi:", listError);
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
