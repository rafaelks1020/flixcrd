import { storageEnv } from "@/lib/storage-config";
import { NextRequest, NextResponse, after } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { wasabiClient } from "@/lib/wasabi";
import { pickSourceObject, hasConverterOutput } from "@/lib/transcode-source";

export const maxDuration = 300;

const bucketName = storageEnv.bucket;
const transcoderBaseUrl = process.env.TRANSCODER_BASE_URL;

function getTranscoderAuthHeaders(): Record<string, string> {
  const token = process.env.TRANSCODER_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
        { error: "S3_BUCKET_NAME não configurado." },
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
        Episode: {
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

    const episodesWithPrefix = (title.Episode ?? []).filter(
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

    // Fontes que já estão na fila ou convertendo: clicar de novo não duplica.
    const busySources = new Set<string>();
    const busyPrefixes = new Set<string>();
    try {
      const jobsRes = await fetch(`${baseUrl}/jobs`, { headers: getTranscoderAuthHeaders() });
      if (jobsRes.ok) {
        const jobs = (await jobsRes.json()) as Array<{ source_key?: string; dest_prefix?: string; status?: string }>;
        for (const j of jobs) {
          if (j.status === "queued" || j.status === "running") {
            if (j.source_key) busySources.add(j.source_key);
            if (j.dest_prefix) busyPrefixes.add(j.dest_prefix);
          }
        }
      }
    } catch {
      // sem a lista, segue sem deduplicar
    }

    // Em paralelo (8 por vez): série com centenas de episódios estourava o tempo da função.
    const processEpisode = async (ep: (typeof episodesWithPrefix)[number]) => {
      const prefix = ep.hlsPath!.endsWith("/") ? ep.hlsPath! : `${ep.hlsPath}/`;

      try {
        const listCmd = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
        });

        const listed = await wasabiClient.send(listCmd);
        const objects = (listed.Contents ?? []).filter(
          // Sobras de upload que não terminou (.rclone_temp_multipart_*, *.partial) não são vídeo.
          (obj) => obj.Key && !/(^|\/)\.rclone_temp|\.partial$/i.test(obj.Key),
        );

        if (objects.some((obj) => /(^|\/)master\.m3u8$/i.test(obj.Key as string))) {
          skipped.push({ episodeId: ep.id, reason: "Já convertido (master.m3u8 existe)." });
          return;
        }

        if (busyPrefixes.has(prefix)) {
          skipped.push({ episodeId: ep.id, reason: "Já está na fila." });
          return;
        }

        const sourceObj = pickSourceObject(objects);

        if (!sourceObj || !sourceObj.Key) {
          skipped.push({
            episodeId: ep.id,
            reason: hasConverterOutput(objects)
              ? "Conversão em andamento ou vídeo de origem já apagado (envie o arquivo de novo)."
              : "Upload do episódio não terminou (sem arquivo de vídeo).",
          });
          return;
        }

        const sourceKey = sourceObj.Key as string;

        if (busySources.has(sourceKey)) {
          skipped.push({ episodeId: ep.id, reason: "Já está na fila." });
          return;
        }

        const transRes = await fetch(`${baseUrl}/jobs/hls`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getTranscoderAuthHeaders(),
          },
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
          return;
        }

        const jobId = (transJson as any)?.job_id ?? null;
        const status = (transJson as any)?.status ?? null;

        if (!jobId) {
          errors.push({
            episodeId: ep.id,
            message: "Serviço de transcodificação não retornou job_id.",
          });
          return;
        }

        queued.push({ episodeId: ep.id, jobId, status });
      } catch (err) {
        errors.push({
          episodeId: ep.id,
          message: err instanceof Error ? err.message : "Erro desconhecido ao enfileirar HLS.",
        });
      }
        };

    // Responde na hora; o enfileiramento segue em segundo plano e cada episódio
    // aparece no HLS Forge assim que entra na fila.
    after(async () => {
      let cursor = 0;
      await Promise.all(
        Array.from({ length: Math.min(8, episodesWithPrefix.length) }, async () => {
          while (cursor < episodesWithPrefix.length) {
            const ep = episodesWithPrefix[cursor++];
            await processEpisode(ep);
          }
        }),
      );
      console.log(
        `[transcode-episodes] ${id}: ${queued.length} na fila, ${skipped.length} ignorados, ${errors.length} erros`,
        errors.slice(0, 3),
      );
    });

    return NextResponse.json({
      ok: true,
      background: true,
      totalEpisodes: title.Episode?.length ?? 0,
      episodesWithPrefix: episodesWithPrefix.length,
      queued: [],
      skipped: [],
      errors: [],
    });
  } catch (error) {
    console.error("POST /api/admin/titles/[id]/transcode-episodes error", error);
    return NextResponse.json(
      { error: "Erro ao enfileirar HLS para episódios." },
      { status: 500 },
    );
  }
}
