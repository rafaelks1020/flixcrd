import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const WASABI_CDN_BASE = process.env.WASABI_CDN_URL;

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
        title: true,
      },
    });

    if (!episode || !episode.title) {
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

    // Como o Wasabi é público via Cloudflare, usamos URLs diretas
    const hlsPath = episode.hlsPath?.endsWith("/") ? episode.hlsPath : `${episode.hlsPath}/`;
    const kind = "hls"; // Assumimos HLS por padrão

    // Sempre usa a rota HLS que vai reescrever os segmentos
    const sourceParam = request.nextUrl.searchParams.get("source");
    const base = `/api/episodes/${episode.id}/hls`;
    const playbackUrl = sourceParam ? `${base}?source=${sourceParam}` : base;

    // Legendas também são públicas via Cloudflare Worker
    const subtitles: any[] = []; // TODO: implementar busca de .vtt se necessário

    const title = episode.title as any;

    return NextResponse.json({
      playbackUrl,
      kind,
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
