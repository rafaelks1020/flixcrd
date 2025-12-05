import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { wasabiClient } from "@/lib/wasabi";

const bucketName = process.env.WASABI_BUCKET_NAME;

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { titleIds } = body as { titleIds: string[] };

    if (!Array.isArray(titleIds) || titleIds.length === 0) {
      return NextResponse.json(
        { error: "titleIds deve ser um array não vazio." },
        { status: 400 },
      );
    }

    // Buscar todos os títulos de uma vez
    const titles = await prisma.title.findMany({
      where: {
        id: {
          in: titleIds,
        },
      },
      select: {
        id: true,
        hlsPath: true,
      },
    });

    const statusMap: Record<string, string> = {};

    // Processar em paralelo (mas em uma única query ao DB)
    await Promise.all(
      titles.map(async (title) => {
        if (!title.hlsPath || title.hlsPath.trim() === "") {
          statusMap[title.id] = "no_upload";
          return;
        }

        const prefix = title.hlsPath.endsWith("/")
          ? title.hlsPath
          : `${title.hlsPath}/`;

        try {
          const listCmd = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            MaxKeys: 10, // Só precisa verificar se tem arquivos
          });

          const listed = await wasabiClient.send(listCmd);
          const contents = listed.Contents ?? [];

          const hasHls = contents.some((obj) =>
            String(obj.Key ?? "").toLowerCase().endsWith(".m3u8"),
          );

          if (hasHls) {
            statusMap[title.id] = "hls_ready";
          } else if (contents.length > 0) {
            statusMap[title.id] = "upload_pending";
          } else {
            statusMap[title.id] = "no_upload";
          }
        } catch {
          statusMap[title.id] = "no_upload";
        }
      }),
    );

    return NextResponse.json({ statusMap });
  } catch (error) {
    console.error("POST /api/admin/titles/hls-status-batch error", error);
    return NextResponse.json(
      { error: "Erro ao verificar status HLS em lote." },
      { status: 500 },
    );
  }
}
