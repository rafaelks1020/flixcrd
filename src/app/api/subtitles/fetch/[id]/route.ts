import { NextRequest, NextResponse } from "next/server";

import zlib from "zlib";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const bucketName = process.env.WASABI_BUCKET_NAME;
const openSubApiKey = process.env.OPENSUBTITLES_API_KEY;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

async function srtToVtt(srt: string): Promise<string> {
  const lines = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = ["WEBVTT", ""];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (/^\d+$/.test(trimmed)) {
      // pula índice de cue
      continue;
    }

    const timeMatch = trimmed.match(
      /^(\d{2}:\d{2}:\d{2}),(\d{3})\s+--\>\s+(\d{2}:\d{2}:\d{2}),(\d{3})(.*)$/,
    );

    if (timeMatch) {
      const [, h1, ms1, h2, ms2, rest] = timeMatch;
      out.push(`${h1}.${ms1} --> ${h2}.${ms2}${rest}`.trimEnd());
    } else {
      out.push(trimmed);
    }
  }

  return out.join("\n");
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!bucketName) {
    return NextResponse.json(
      { error: "WASABI_BUCKET_NAME não configurado." },
      { status: 500 },
    );
  }

  if (!openSubApiKey) {
    return NextResponse.json(
      { error: "OPENSUBTITLES_API_KEY não configurado." },
      { status: 500 },
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const language: string = body?.language || "pt-BR";

    const title = await prisma.title.findUnique({ where: { id } });
    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    const safeSlug = title.slug || `title-${title.id}`;
    const prefixFromTitle = title.hlsPath
      ? title.hlsPath.endsWith("/")
        ? title.hlsPath
        : `${title.hlsPath}/`
      : `titles/${safeSlug}/`;

    const query = title.name;
    let year: string | undefined;
    if (title.releaseDate instanceof Date) {
      year = String(title.releaseDate.getFullYear());
    } else if (typeof title.releaseDate === "string") {
      year = title.releaseDate.slice(0, 4);
    }

    const searchParams = new URLSearchParams();
    if (query) searchParams.set("query", query);
    if (year) searchParams.set("year", year);
    // OpenSubtitles usa ISO para languages, ex: pt-BR, en
    if (language) searchParams.set("languages", language);
    searchParams.set("order_by", "download_count");
    searchParams.set("order_direction", "desc");

    const searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?${searchParams.toString()}`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        "Api-Key": openSubApiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const searchJson: any = await searchRes.json().catch(() => null);

    if (!searchRes.ok) {
      const message =
        searchJson?.message || searchJson?.error || "Erro ao buscar legendas no OpenSubtitles";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const results: any[] = Array.isArray(searchJson?.data) ? searchJson.data : [];

    if (results.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma legenda encontrada para este título/idioma." },
        { status: 404 },
      );
    }

    const chosen = results[0];
    const fileId: number | undefined = chosen?.attributes?.files?.[0]?.file_id;

    if (!fileId) {
      return NextResponse.json(
        { error: "Resposta do OpenSubtitles não contém file_id válido." },
        { status: 500 },
      );
    }

    const downloadRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: {
        "Api-Key": openSubApiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    const downloadJson: any = await downloadRes.json().catch(() => null);

    if (!downloadRes.ok) {
      const message =
        downloadJson?.message || downloadJson?.error || "Erro ao obter link de download da legenda";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const link: string | undefined = downloadJson?.link;
    if (!link) {
      return NextResponse.json(
        { error: "OpenSubtitles não retornou link de download." },
        { status: 500 },
      );
    }

    const subRes = await fetch(link);
    const arrayBuffer = await subRes.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    let text: string;
    // Se o arquivo vier compactado em gzip, descompacta antes de converter para texto.
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      const unzipped = zlib.gunzipSync(buf);
      text = unzipped.toString("utf-8");
    } else {
      text = buf.toString("utf-8");
    }

    const vtt = await srtToVtt(text);

    const langSuffix = language.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const key = `${prefixFromTitle}subtitle-${langSuffix || "sub"}.vtt`;

    const putCmd = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: vtt,
      ContentType: "text/vtt; charset=utf-8",
    });

    await wasabiClient.send(putCmd);

    return NextResponse.json({ ok: true, key });
  } catch (error) {
    console.error("POST /api/subtitles/fetch/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao buscar e salvar legenda." },
      { status: 500 },
    );
  }
}
