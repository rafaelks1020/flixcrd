import { storageEnv } from "@/lib/storage-config";
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

    const source =
      (request.nextUrl.searchParams.get("source") as "direct" | "cloudflare" | null) ??
      "cloudflare"; // Padrão Cloudflare

    const variant = request.nextUrl.searchParams.get("variant");
    const variantName = variant?.trim() || "";
    if (variantName && isUnsafeObjectKey(variantName)) {
      return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
    }

    const playlistPath = variantName ? `${prefix}${variantName}` : `${prefix}master.m3u8`;
    const cdnBase = storageEnv.cdnUrl;
    const playlistUrl = cdnBase ? `${cdnBase}${playlistPath}` : playlistPath;

    console.log(`[HLS] Buscando playlist: ${playlistUrl}`);

    const original = await readObjectText(playlistPath);

    if (original == null) {
      console.error(`[HLS] Playlist não encontrado: ${playlistUrl} - Status: 404`);
      return NextResponse.json(
        {
          error: "Playlist HLS não encontrado.",
          debug: {
            playlistUrl,
            hlsPath: title.hlsPath,
            status: 404,
          },
        },
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
    console.error("GET /api/titles/[id]/hls error", error);
    return NextResponse.json(
      { error: "Erro ao gerar playlist HLS assinada." },
      { status: 500 },
    );
  }
}
