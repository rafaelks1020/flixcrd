import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { wasabiClient } from "@/lib/wasabi";

const bucketName = process.env.WASABI_BUCKET_NAME;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { id } = await context.params;

    const episode = await prisma.episode.findUnique({
      where: { id },
      select: {
        hlsPath: true,
      },
    });

    if (!episode) {
      return NextResponse.json({ error: "Episódio não encontrado." }, { status: 404 });
    }

    if (!bucketName) {
      return NextResponse.json(
        { error: "WASABI_BUCKET_NAME não configurado." },
        { status: 500 },
      );
    }

    if (!episode.hlsPath || episode.hlsPath.trim() === "") {
      return NextResponse.json({
        hasPrefix: false,
        hasObjects: false,
        hasSource: false,
        hasHls: false,
        status: "none",
      });
    }

    const prefix = episode.hlsPath.endsWith("/")
      ? episode.hlsPath
      : `${episode.hlsPath}/`;

    const listCmd = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const listed = await wasabiClient.send(listCmd);
    const contents = listed.Contents ?? [];

    const hasObjects = contents.length > 0;
    const hasHls = contents.some((obj) =>
      String(obj.Key ?? "").toLowerCase().endsWith(".m3u8"),
    );
    const hasSource = contents.some((obj) =>
      /\.(mkv|mp4|m4v|mov|webm|avi)$/i.test(String(obj.Key ?? "")),
    );

    let status: "none" | "uploaded" | "hls_ready";
    if (!hasObjects) {
      status = "none";
    } else if (hasHls) {
      status = "hls_ready";
    } else {
      status = "uploaded";
    }

    return NextResponse.json({
      hasPrefix: true,
      hasObjects,
      hasSource,
      hasHls,
      status,
    });
  } catch (error) {
    console.error("GET /api/admin/episodes/[id]/hls-status error", error);
    return NextResponse.json(
      { error: "Erro ao verificar status HLS do episódio." },
      { status: 500 },
    );
  }
}
