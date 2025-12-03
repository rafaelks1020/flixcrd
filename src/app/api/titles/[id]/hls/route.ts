import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";
import { authOptions } from "@/lib/auth";

const bucketName = process.env.WASABI_BUCKET_NAME;

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

export async function GET(_request: NextRequest, context: RouteContext) {
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

    const signedLines = await Promise.all(
      lines.map(async (line) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
          return line;
        }

        if (!trimmed.endsWith(".ts")) {
          return line;
        }

        const segmentKey = `${prefix}${trimmed}`;

        const cmd = new GetObjectCommand({
          Bucket: bucketName,
          Key: segmentKey,
        });

        const url = await import("@aws-sdk/s3-request-presigner").then(({ getSignedUrl }) =>
          getSignedUrl(wasabiClient, cmd, { expiresIn: 60 * 60 }),
        );

        return url;
      }),
    );

    const rewritten = signedLines.join("\n");

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
