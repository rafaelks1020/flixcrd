import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";
import { hasActiveSubscription } from "@/lib/subscription";
import { isUnsafeObjectKey } from "@/lib/object-key";
import { isHlsSegmentReference, playlistCacheControl, publicOrSignedUrl, readObjectText } from "@/lib/media-url";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 },
    );
  }

  if (user.role !== "ADMIN" && !(await hasActiveSubscription(user.id))) {
    return NextResponse.json(
      { error: "Assinatura necessária para assistir." },
      { status: 403 },
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
    const variantName = variant?.trim() || "";
    if (variantName && isUnsafeObjectKey(variantName)) {
      return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
    }

    const playlistPath = variantName ? `${prefix}${variantName}` : `${prefix}master.m3u8`;
    const original = await readObjectText(playlistPath);
    if (original == null) {
      return NextResponse.json(
        { error: "Playlist HLS não encontrado." },
        { status: 404 },
      );
    }

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

        // Segmento (.ts, .m4s, .aac, .vtt, .key): CDN pública ou URL assinada.
        if (isHlsSegmentReference(trimmed)) {
          if (isUnsafeObjectKey(trimmed)) return line;
          const objectKey = `${prefix}${trimmed}`;
          return publicOrSignedUrl(objectKey);
        }

        return line;
      }),
    );

    const rewritten = rewrittenLines.join("\n");

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": playlistCacheControl(),
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
