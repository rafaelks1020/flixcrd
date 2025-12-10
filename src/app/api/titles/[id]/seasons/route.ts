import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const WASABI_BUCKET = process.env.WASABI_BUCKET_NAME;

/**
 * GET /api/titles/[id]/seasons
 * Retorna todas as temporadas e episódios de um título
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Buscar temporadas com episódios
    const seasons = await prisma.season.findMany({
      where: { titleId: id },
      orderBy: { seasonNumber: "asc" },
      include: {
        episodes: {
          orderBy: { episodeNumber: "asc" },
          select: {
            id: true,
            episodeNumber: true,
            name: true,
            overview: true,
            stillUrl: true,
            runtime: true,
            airDate: true,
            hlsPath: true,
          },
        },
      },
    });

    // Se não houver bucket configurado, apenas retorna as temporadas como antes
    if (!WASABI_BUCKET) {
      return NextResponse.json(seasons);
    }

    // Para cada episódio, verificar se há algum arquivo .vtt no prefixo do hlsPath
    const seasonsWithSubtitles = await Promise.all(
      seasons.map(async (season) => {
        const episodesWithFlag = await Promise.all(
          (season.episodes ?? []).map(async (ep) => {
            let hasSubtitle = false;

            if (ep.hlsPath && ep.hlsPath.trim() !== "") {
              try {
                const prefix = ep.hlsPath.endsWith("/") ? ep.hlsPath : `${ep.hlsPath}/`;
                const cmd = new ListObjectsV2Command({
                  Bucket: WASABI_BUCKET,
                  Prefix: prefix,
                  MaxKeys: 50,
                });

                const listed = await wasabiClient.send(cmd);
                const contents = listed.Contents ?? [];
                hasSubtitle = contents.some((obj) => {
                  const key = obj.Key ?? "";
                  return key.toLowerCase().endsWith(".vtt");
                });
              } catch (err) {
                // Se der erro ao checar no Wasabi, apenas loga e segue sem marcar legenda
                console.error("Erro ao verificar legendas para episódio", ep.id, err);
              }
            }

            return {
              ...ep,
              hasSubtitle,
            };
          }),
        );

        return {
          ...season,
          episodes: episodesWithFlag,
        };
      }),
    );

    return NextResponse.json(seasonsWithSubtitles);
  } catch (error) {
    console.error("GET /api/titles/[id]/seasons error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar temporadas" },
      { status: 500 }
    );
  }
}
