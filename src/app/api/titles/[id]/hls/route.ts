import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";
import { authOptions } from "@/lib/auth";

const bucketName = process.env.WASABI_BUCKET_NAME;
// Bases públicas para streaming direto ou via proxy Cloudflare
const WASABI_PUBLIC_BASE = "https://s3.us-east-1.wasabisys.com";
const CLOUDFLARE_PROXY_BASE = "https://wasabi-proxy.crdozo-rafael1028.workers.dev";

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
  if (!bucketName) {
    return NextResponse.json(
      { error: "WASABI_BUCKET_NAME não configurado." },
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

    const variant = request.nextUrl.searchParams.get("variant");
    const source =
      (request.nextUrl.searchParams.get("source") as "wasabi" | "cloudflare" | null) ??
      "wasabi";

    let playlistKey: string;

    if (variant && variant.trim().length > 0) {
      // Quando ?variant= é passado, carregamos diretamente o playlist indicado
      playlistKey = `${prefix}${variant.trim()}`;
    } else {
      // Master: precisamos descobrir o master.m3u8 no prefixo
      const listCmd = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      });

      const listed = await wasabiClient.send(listCmd);

      if (!listed.Contents || listed.Contents.length === 0) {
        return NextResponse.json(
          { error: "Nenhum arquivo encontrado no prefixo HLS." },
          { status: 404 },
        );
      }

      const objects = listed.Contents.filter((obj) => obj.Key);
      const masterObject =
        objects.find((obj) =>
          (obj.Key as string).toLowerCase().endsWith("master.m3u8"),
        ) ??
        objects.find((obj) =>
          (obj.Key as string).toLowerCase().endsWith(".m3u8"),
        );

      if (!masterObject || !masterObject.Key) {
        return NextResponse.json(
          { error: "Arquivo master.m3u8 não encontrado." },
          { status: 404 },
        );
      }

      playlistKey = masterObject.Key as string;
    }

    const getCmd = new GetObjectCommand({
      Bucket: bucketName,
      Key: playlistKey,
    });

    const playlistObj = await wasabiClient.send(getCmd);

    const original = await streamToString(playlistObj.Body);

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

        // Segmentos de vídeo (.ts): gerar URL via proxy Cloudflare ou URL assinada do Wasabi
        if (trimmed.toLowerCase().endsWith(".ts")) {
          const objectKey = `${prefix}${trimmed}`;

          if (source === "cloudflare") {
            return `${CLOUDFLARE_PROXY_BASE}/${objectKey}`;
          }

          // Default: Wasabi com URL assinada (bucket não é público)
          const cmd = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
          });

          const url = await import("@aws-sdk/s3-request-presigner").then(
            ({ getSignedUrl }) =>
              getSignedUrl(wasabiClient, cmd, {
                expiresIn: 60 * 60,
              }),
          );

          return url;
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
    console.error("GET /api/titles/[id]/hls error", error);
    return NextResponse.json(
      { error: "Erro ao gerar playlist HLS assinada." },
      { status: 500 },
    );
  }
}
