import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const B2_CLOUDFLARE_BASE = process.env.B2_LINK; // https://hlspaelflix.top/b2/

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

    // Como o B2 é público via Cloudflare, usamos URLs diretas
    const hlsPath = title.hlsPath?.endsWith("/") ? title.hlsPath : `${title.hlsPath}/`;
    const kind = "hls"; // Assumimos HLS por padrão

    // Sempre usa a rota HLS que vai reescrever os segmentos
    const sourceParam = request.nextUrl.searchParams.get("source");
    const base = `/api/titles/${title.id}/hls`;
    const playbackUrl = sourceParam ? `${base}?source=${sourceParam}` : base;

    // Legendas também são públicas via Cloudflare
    const subtitles: any[] = []; // TODO: implementar busca de .vtt se necessário

    return NextResponse.json({
      playbackUrl,
      kind: "hls",
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
