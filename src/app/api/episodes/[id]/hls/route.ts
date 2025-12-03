import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";
import { authOptions } from "@/lib/auth";

const bucketName = process.env.WASABI_BUCKET_NAME;
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
      (request.nextUrl.searchParams.get("source") as "wasabi" | "cloudflare" | null) ??
      "wasabi";

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
    const hlsObject = objects.find((obj) =>
      (obj.Key as string).toLowerCase().endsWith(".m3u8"),
    );

    if (!hlsObject || !hlsObject.Key) {
      return NextResponse.json(
        { error: "Arquivo master.m3u8 não encontrado." },
        { status: 404 },
      );
    }

    const playlistKey = hlsObject.Key as string;

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

        if (!trimmed.toLowerCase().endsWith(".ts")) {
          return line;
        }

        const objectKey = `${prefix}${trimmed}`;

        if (source === "cloudflare") {
          return `${CLOUDFLARE_PROXY_BASE}/${objectKey}`;
        }

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
