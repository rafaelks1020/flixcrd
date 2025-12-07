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

async function streamToString(body: any): Promise<string> {
  if (!body) return "";

  if (typeof body === "string") return body;

  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    body.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    });
    body.on("end", () => {
      const merged = Buffer.concat(chunks as any);
      resolve(merged.toString("utf-8"));
    });
    body.on("error", (err: unknown) => {
      reject(err);
    });
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!WASABI_CDN_BASE) {
    return NextResponse.json(
      { error: "WASABI_CDN_URL não configurado." },
      { status: 500 },
    );
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 },
    );
  }

  try {
    const { id } = await context.params;

    const episode = await prisma.episode.findUnique({ where: { id } });

    if (!episode) {
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

    const prefix = episode.hlsPath.endsWith("/")
      ? episode.hlsPath
      : `${episode.hlsPath}/`;

    const source =
      (request.nextUrl.searchParams.get("source") as "direct" | "cloudflare" | null) ??
      "cloudflare"; // Padrão Cloudflare

    const variant = request.nextUrl.searchParams.get("variant");

    // Busca o playlist diretamente via URL pública
    const playlistPath = variant ? `${prefix}${variant.trim()}` : `${prefix}master.m3u8`;
    const playlistUrl = `${WASABI_CDN_BASE}${playlistPath}`;

    const response = await fetch(playlistUrl, {
      // Permite que o Cloudflare cache o playlist
      cache: 'default',
      headers: {
        'Accept': 'application/vnd.apple.mpegurl, */*',
      },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Playlist HLS não encontrado." },
        { status: 404 },
      );
    }

    const original = await response.text();

    const lines = original.split(/\r?\n/);

    const rewrittenLines = await Promise.all(
      lines.map(async (line) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
          return line;
        }

        // Já é uma URL absoluta? mantém como está
        if (/^https?:\/\//i.test(trimmed)) {
          return line;
        }

        // Playlists variantes (.m3u8): apontar para esta mesma rota com ?variant= e manter o mesmo source
        if (trimmed.toLowerCase().endsWith(".m3u8")) {
          const url = new URL(request.url);
          url.searchParams.set("variant", trimmed);
          if (source) {
            url.searchParams.set("source", source);
          }
          return `${url.pathname}?${url.searchParams.toString()}`;
        }

        // Segmentos de vídeo (.ts): sempre URL pública via Wasabi CDN
        if (trimmed.toLowerCase().endsWith(".ts")) {
          const objectKey = `${prefix}${trimmed}`;
          return `${WASABI_CDN_BASE}${objectKey}`;
        }

        return line;
      }),
    );

    const rewritten = rewrittenLines.join("\n");

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        // Cache por 5 minutos no browser, revalidar depois
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("GET /api/episodes/[id]/hls error", error);
    return NextResponse.json(
      { error: "Erro ao gerar playlist HLS assinada para episódio." },
      { status: 500 },
    );
  }
}
