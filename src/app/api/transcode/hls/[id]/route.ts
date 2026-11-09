import { storageEnv } from "@/lib/storage-config";
import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";
import { adminDenied } from "@/lib/require-admin";
import { pickSourceObject, hasConverterOutput } from "@/lib/transcode-source";

export const maxDuration = 120;

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

export async function GET(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;

  const jobId = request.nextUrl.searchParams.get("job_id");

  if (!transcoderBaseUrl) {
    return NextResponse.json(
      { error: "TRANSCODER_BASE_URL não configurado no .env." },
      { status: 500 },
    );
  }

  if (!jobId) {
    return NextResponse.json(
      { error: "Parâmetro job_id é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const url = `${transcoderBaseUrl.replace(/\/+$/, "")}/jobs/${encodeURIComponent(jobId)}`;
    const res = await fetch(url, {
      headers: getTranscoderAuthHeaders(),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = (data as any)?.detail ?? (data as any)?.error ?? "Erro ao buscar status do job";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/transcode/hls status error", error);
    return NextResponse.json(
      { error: "Erro ao buscar status do job de transcodificação." },
      { status: 500 },
    );
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const denied = await adminDenied();
  if (denied) return denied;

  if (!bucketName) {
    return NextResponse.json(
      { error: "WASABI_BUCKET_NAME não configurado." },
      { status: 500 },
    );
  }

  if (!transcoderBaseUrl) {
    return NextResponse.json(
      { error: "TRANSCODER_BASE_URL não configurado no .env." },
      { status: 500 },
    );
  }

  try {
    const body = await _request.json().catch(() => null);

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

    const title = await prisma.title.findUnique({ where: { id } });
    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    if (!title.hlsPath) {
      return NextResponse.json(
        { error: "Título não possui caminho HLS configurado (hlsPath)." },
        { status: 400 },
      );
    }

    const prefix = title.hlsPath.endsWith("/") ? title.hlsPath : `${title.hlsPath}/`;

    const listCmd = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const listed = await wasabiClient.send(listCmd);

    if (!listed.Contents || listed.Contents.length === 0) {
      return NextResponse.json(
        { error: "Sem vídeo no storage: o upload deste título não terminou. Envie o arquivo de novo." },
        { status: 404 },
      );
    }

    const objects = listed.Contents.filter(
      // Sobras de upload que não terminou (.rclone_temp_multipart_*, *.partial) não são vídeo.
      (obj) => obj.Key && !/(^|\/)\.rclone_temp|\.partial$/i.test(obj.Key),
    );

    if (objects.length === 0) {
      return NextResponse.json(
        { error: "Sem vídeo no storage: o upload deste título não terminou. Envie o arquivo de novo." },
        { status: 404 },
      );
    }

    const sourceObj = pickSourceObject(objects);

    if (!sourceObj || !sourceObj.Key) {
      return NextResponse.json(
        {
          error: hasConverterOutput(objects)
            ? "Conversão em andamento ou vídeo de origem já apagado. Envie o arquivo de novo."
            : "Sem vídeo no storage: o upload deste título não terminou. Envie o arquivo de novo.",
        },
        { status: 404 },
      );
    }

    const sourceKey = sourceObj.Key as string;

    const url = `${transcoderBaseUrl.replace(/\/+$/, "")}/jobs/hls`;

    const transRes = await fetch(url, {
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
      const message = (transJson as any)?.detail ?? (transJson as any)?.error ?? "Erro ao chamar serviço de transcodificação";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const jobId = (transJson as any)?.job_id ?? null;
    const status = (transJson as any)?.status ?? null;

    if (!jobId) {
      return NextResponse.json(
        { error: "Serviço de transcodificação não retornou job_id." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      jobId,
      status,
    });
  } catch (error) {
    console.error("POST /api/transcode/hls/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao iniciar transcodificação HLS." },
      { status: 500 },
    );
  }
}
