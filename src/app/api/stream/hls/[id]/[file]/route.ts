import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { Readable } from "stream";

import { prisma } from "@/lib/prisma";
import { b2Client } from "@/lib/b2";
import { authOptions } from "@/lib/auth";

const bucketName = process.env.B2_BUCKET;

interface RouteContext {
  params: Promise<{
    id: string;
    file: string;
  }>;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    stream.on("error", (err) => {
      reject(err);
    });
  });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!bucketName) {
    return NextResponse.json(
      { error: "B2_BUCKET não configurado." },
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
    const { id, file } = await context.params;

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

    const key = `${prefix}${file}`;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const result = await b2Client.send(command);

    if (!result.Body) {
      return NextResponse.json(
        { error: "Objeto não encontrado no B2." },
        { status: 404 },
      );
    }

    const buffer = await streamToBuffer(result.Body as Readable);

    const headers = new Headers();

    const lower = file.toLowerCase();
    if (lower.endsWith(".m3u8")) {
      headers.set("Content-Type", "application/vnd.apple.mpegurl");
    } else if (lower.endsWith(".ts")) {
      headers.set("Content-Type", "video/mp2t");
    } else {
      headers.set("Content-Type", result.ContentType || "application/octet-stream");
    }

    if (typeof result.ContentLength === "number") {
      headers.set("Content-Length", String(result.ContentLength));
    }

    // Evita cache agressivo; pode ajustar depois conforme necessidade.
    headers.set("Cache-Control", "private, max-age=0, no-store");

    return new NextResponse(buffer as any, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("GET /api/stream/hls/[id]/[file] error", error);
    return NextResponse.json(
      { error: "Erro ao transmitir conteúdo HLS." },
      { status: 500 },
    );
  }
}
