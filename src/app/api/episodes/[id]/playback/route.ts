import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";
import { generateStreamToken, isProtectedStreamingEnabled } from "@/lib/stream-token";
import { wasabiClient } from "@/lib/wasabi";

const WASABI_CDN_BASE = process.env.WASABI_CDN_URL;
const WASABI_BUCKET = process.env.WASABI_BUCKET_NAME;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface SubtitleTrack {
  label: string;
  language?: string | null;
  url: string;
}

function inferSubtitleInfoFromKey(key: string): { label: string; language?: string | null } {
  const lower = key.toLowerCase();

  if (lower.includes("pt-br") || lower.includes("ptbr") || lower.includes("pt_b")) {
    return { label: "Português (Brasil)", language: "pt-BR" };
  }

  if (lower.includes("pt")) {
    return { label: "Português", language: "pt" };
  }

  if (lower.includes("en")) {
    return { label: "Inglês", language: "en" };
  }

  if (lower.includes("es")) {
    return { label: "Espanhol", language: "es" };
  }

  return { label: "Legenda", language: null };
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

    const episode = await prisma.episode.findUnique({
      where: { id },
      include: {
        Title: true,
      },
    });

    if (!episode || !episode.Title) {
      return NextResponse.json(
        { error: "Episódio não encontrado." },
        { status: 404 },
      );
    }

    if (!episode.hlsPath) {
      return NextResponse.json(
        { error: "Episódio não possui caminho HLS configurado." },
        { status: 400 },
      );
    }

    const kind = "hls";
    const sourceParam = request.nextUrl.searchParams.get("source");

    // Tentar usar streaming protegido
    let playbackUrl: string;
    let expiresAt: number | null = null;
    let isProtected = false;

    if (isProtectedStreamingEnabled() && episode.hlsPath) {
      // Gerar token via Cloudflare Worker
      const cleanPath = episode.hlsPath.endsWith("/") 
        ? episode.hlsPath.slice(0, -1) 
        : episode.hlsPath;
      
      const tokenData = await generateStreamToken(cleanPath, "wasabi");
      
      if (tokenData) {
        playbackUrl = tokenData.streamUrl;
        expiresAt = tokenData.expiresAt;
        isProtected = true;
      } else {
        // Fallback para API antiga
        const base = `/api/episodes/${episode.id}/hls`;
        playbackUrl = sourceParam ? `${base}?source=${sourceParam}` : base;
      }
    } else {
      // Streaming protegido não configurado, usa API antiga
      const base = `/api/episodes/${episode.id}/hls`;
      playbackUrl = sourceParam ? `${base}?source=${sourceParam}` : base;
    }

    // Legendas
    let subtitles: SubtitleTrack[] = [];

    if (WASABI_BUCKET && episode.hlsPath) {
      try {
        const prefix = episode.hlsPath.endsWith("/") ? episode.hlsPath : `${episode.hlsPath}/`;
        const listCmd = new ListObjectsV2Command({
          Bucket: WASABI_BUCKET,
          Prefix: prefix,
          MaxKeys: 50,
        });

        const listed = await wasabiClient.send(listCmd);
        const contents = listed.Contents ?? [];
        const subtitleObjects = contents.filter((obj) =>
          (obj.Key as string).toLowerCase().endsWith(".vtt"),
        );

        subtitles = subtitleObjects.map((obj) => {
          const key = obj.Key as string;
          const { label, language } = inferSubtitleInfoFromKey(key);
          return {
            label,
            language,
            url: `${WASABI_CDN_BASE}${key}`,
          };
        });
      } catch (subErr) {
        console.error("Erro ao listar legendas para episódio", episode.id, subErr);
      }
    }

    const title = episode.Title;

    return NextResponse.json({
      playbackUrl,
      kind,
      expiresAt,
      protected: isProtected,
      subtitles,
      title: {
        id: title.id,
        name: title.name,
        originalName: title.originalName,
        overview: episode.overview || title.overview,
        releaseDate: episode.airDate ?? title.releaseDate,
        posterUrl: title.posterUrl,
        backdropUrl: title.backdropUrl,
        type: title.type,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeName: episode.name,
      },
    });
  } catch (error) {
    console.error("GET /api/episodes/[id]/playback error", error);
    return NextResponse.json(
      { error: "Erro ao gerar URL de playback para episódio." },
      { status: 500 },
    );
  }
}
