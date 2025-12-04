import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const B2_CLOUDFLARE_BASE = process.env.B2_LINK;

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
  if (!B2_CLOUDFLARE_BASE) {
    return NextResponse.json(
      { error: "B2_LINK não configurado." },
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
      (request.nextUrl.searchParams.get("source") as "b2" | "cloudflare" | null) ??
      "cloudflare"; // Padrão Cloudflare

    // Busca o playlist diretamente via URL pública
    const playlistPath = `${prefix}master.m3u8`;
    const playlistUrl = `${B2_CLOUDFLARE_BASE}${playlistPath}`;

    const response = await fetch(playlistUrl);
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

        // Segmentos de vídeo (.ts): sempre URL pública via B2_LINK
        if (trimmed.toLowerCase().endsWith(".ts")) {
          const objectKey = `${prefix}${trimmed}`;
          return `${B2_CLOUDFLARE_BASE}${objectKey}`;
        }

        return line;
      }),
    );

    const rewritten = rewrittenLines.join("\n");

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "private, max-age=0, no-store",
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
