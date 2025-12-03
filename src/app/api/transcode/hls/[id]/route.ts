import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";

const bucketName = process.env.WASABI_BUCKET_NAME;
const transcoderBaseUrl = process.env.TRANSCODER_BASE_URL;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest) {
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
    const url = `${transcoderBaseUrl.replace(/\/+$/, "")}/jobs/${jobId}`;
    const res = await fetch(url);
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
        { error: "Nenhum arquivo encontrado nesse prefixo no Wasabi." },
        { status: 404 },
      );
    }

    const objects = listed.Contents.filter((obj) => obj.Key);

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
      return NextResponse.json(
        { error: "Não foi possível determinar o arquivo de origem para transcodificação." },
        { status: 400 },
      );
    }

    const sourceKey = sourceObj.Key as string;

    const url = `${transcoderBaseUrl.replace(/\/+$/, "")}/jobs/hls`;

    const transRes = await fetch(url, {
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
