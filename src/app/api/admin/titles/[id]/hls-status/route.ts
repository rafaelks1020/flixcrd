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

    if (!bucketName) {
      return NextResponse.json(
        { error: "WASABI_BUCKET_NAME não configurado." },
        { status: 500 },
      );
    }

    const { id } = await context.params;

    const title = await prisma.title.findUnique({ where: { id } });
    if (!title) {
      return NextResponse.json({ error: "Título não encontrado." }, { status: 404 });
    }

    if (!title.hlsPath) {
      return NextResponse.json({ hasHls: false });
    }

    const prefix = title.hlsPath.endsWith("/") ? title.hlsPath : `${title.hlsPath}/`;

    const listCmd = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const listed = await wasabiClient.send(listCmd);

    const hasHls = Boolean(
      listed.Contents?.some((obj) =>
        String(obj.Key ?? "").toLowerCase().endsWith(".m3u8"),
      ),
    );

    return NextResponse.json({ hasHls });
  } catch (error) {
    console.error("GET /api/admin/titles/[id]/hls-status error", error);
    return NextResponse.json(
      { error: "Erro ao verificar status do HLS." },
      { status: 500 },
    );
  }
}
