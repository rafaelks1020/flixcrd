import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { b2Client } from "@/lib/b2";

const bucketName = process.env.B2_BUCKET;
const transcoderBaseUrl = process.env.TRANSCODER_BASE_URL;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    if (!bucketName) {
      return NextResponse.json(
        { error: "B2_BUCKET não configurado." },
        { status: 500 },
      );
    }

    if (!transcoderBaseUrl) {
      return NextResponse.json(
        { error: "TRANSCODER_BASE_URL não configurado no .env." },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));

    let crf: number | undefined;
    let deleteSource = false;

    if (body && typeof body.crf !== "undefined") {
      const parsed = Number(body.crf);
      if (!Number.isNaN(parsed)) {
        crf = parsed;
      }
    }

    if (body && typeof body.deleteSource !== "undefined") {
      deleteSource = Boolean(body.deleteSource);
    }

    const { id } = await context.params;

    const title = await prisma.title.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        episodes: {
          select: {
            id: true,
            hlsPath: true,
          },
        },
      },
    });

    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    if (title.type !== "SERIES" && title.type !== "ANIME") {
      return NextResponse.json(
        { error: "Esta rota só é válida para séries/animes." },
        { status: 400 },
      );
    }

    const episodesWithPrefix = (title.episodes ?? []).filter(
      (ep) => ep.hlsPath && ep.hlsPath.trim() !== "",
    );

    if (episodesWithPrefix.length === 0) {
      return NextResponse.json(
        { error: "Nenhum episódio com upload encontrado (hlsPath vazio)." },
        { status: 400 },
      );
    }

    const queued: Array<{ episodeId: string; jobId: string; status: string | null }> = [];
    const skipped: Array<{ episodeId: string; reason: string }> = [];
    const errors: Array<{ episodeId: string; message: string }> = [];

    const baseUrl = transcoderBaseUrl.replace(/\/+$/, "");

    for (const ep of episodesWithPrefix) {
      const prefix = ep.hlsPath!.endsWith("/") ? ep.hlsPath! : `${ep.hlsPath}/`;

      try {
        const listCmd = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
        });

        const listed = await b2Client.send(listCmd);
        const objects = (listed.Contents ?? []).filter((obj) => obj.Key);

        if (objects.length === 0) {
          skipped.push({
            episodeId: ep.id,
            reason: "Nenhum arquivo encontrado no prefixo do episódio.",
          });
          continue;
        }

        let sourceObj = objects.find((obj) =>
          /\.(mkv|mp4|mov|webm)$/i.test(obj.Key as string),
        );

        if (!sourceObj) {
          sourceObj = objects.reduce((acc, obj) => {
            if (!acc) return obj;
            return (Number(obj.Size ?? 0) > Number(acc.Size ?? 0) ? obj : acc) as typeof obj;
          }, objects[0]);
        }

        if (!sourceObj || !sourceObj.Key) {
          skipped.push({
            episodeId: ep.id,
            reason: "Não foi possível determinar o arquivo de origem para transcodificação.",
          });
          continue;
        }

        const sourceKey = sourceObj.Key as string;

        const transRes = await fetch(`${baseUrl}/jobs/hls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: bucketName,
            source_key: sourceKey,
            dest_prefix: prefix,
            ...(typeof crf === "number" ? { crf } : {}),
            delete_source: deleteSource,
          }),
        });

        const transJson = await transRes.json().catch(() => null);

        if (!transRes.ok) {
          const message =
            (transJson as any)?.detail ||
            (transJson as any)?.error ||
            "Erro ao chamar serviço de transcodificação";
          errors.push({ episodeId: ep.id, message });
          continue;
        }

        const jobId = (transJson as any)?.job_id ?? null;
        const status = (transJson as any)?.status ?? null;

        if (!jobId) {
          errors.push({
            episodeId: ep.id,
            message: "Serviço de transcodificação não retornou job_id.",
          });
          continue;
        }

        queued.push({ episodeId: ep.id, jobId, status });
      } catch (err: any) {
        errors.push({
          episodeId: ep.id,
          message: err?.message || "Erro desconhecido ao enfileirar HLS.",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      totalEpisodes: title.episodes?.length ?? 0,
      episodesWithPrefix: episodesWithPrefix.length,
      queued,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("POST /api/admin/titles/[id]/transcode-episodes error", error);
    return NextResponse.json(
      { error: "Erro ao enfileirar HLS para episódios." },
      { status: 500 },
    );
  }
}
