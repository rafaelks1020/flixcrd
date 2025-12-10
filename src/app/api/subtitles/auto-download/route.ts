import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import zlib from "zlib";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";

const bucketName = process.env.WASABI_BUCKET_NAME;
const openSubApiKey = process.env.OPENSUBTITLES_API_KEY;

function srtToVtt(srt: string): string {
  const lines = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = ["WEBVTT", ""];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (/^\d+$/.test(trimmed)) {
      continue;
    }

    const timeMatch = trimmed.match(
      /^(\d{2}:\d{2}:\d{2}),(\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}),(\d{3})(.*)$/,
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

/**
 * POST /api/subtitles/auto-download
 * Body: { episodeId: string, fileId: number, language?: string }
 * 
 * Baixa legenda do OpenSubtitles, converte pra VTT e salva no Wasabi
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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

    const body = await request.json();
    const { episodeId, fileId, language = "pt-BR" } = body;

    if (!episodeId) {
      return NextResponse.json(
        { error: "episodeId é obrigatório." },
        { status: 400 },
      );
    }

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId é obrigatório." },
        { status: 400 },
      );
    }

    // Buscar episódio
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { title: true },
    });

    if (!episode) {
      return NextResponse.json(
        { error: "Episódio não encontrado." },
        { status: 404 },
      );
    }

    if (!episode.hlsPath) {
      return NextResponse.json(
        { error: "Episódio não possui hlsPath configurado." },
        { status: 400 },
      );
    }

    // Obter link de download do OpenSubtitles
    const downloadRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: {
        "Api-Key": openSubApiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "FlixCRD v1.0",
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    if (!downloadRes.ok) {
      const errorText = await downloadRes.text();
      console.error("OpenSubtitles download error:", errorText);
      return NextResponse.json(
        { error: "Erro ao obter link de download do OpenSubtitles." },
        { status: 500 },
      );
    }

    const downloadJson = await downloadRes.json();
    const link: string | undefined = downloadJson?.link;

    if (!link) {
      return NextResponse.json(
        { error: "OpenSubtitles não retornou link de download." },
        { status: 500 },
      );
    }

    // Baixar o arquivo de legenda
    const subRes = await fetch(link);
    if (!subRes.ok) {
      return NextResponse.json(
        { error: "Erro ao baixar arquivo de legenda." },
        { status: 500 },
      );
    }

    const arrayBuffer = await subRes.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    let text: string;
    // Se o arquivo vier compactado em gzip, descompacta
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      const unzipped = zlib.gunzipSync(buf);
      text = unzipped.toString("utf-8");
    } else {
      text = buf.toString("utf-8");
    }

    // Converter SRT para VTT
    const vtt = srtToVtt(text);

    // Montar o path no Wasabi
    const prefix = episode.hlsPath.endsWith("/") ? episode.hlsPath : `${episode.hlsPath}/`;
    const langSuffix = language.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const key = `${prefix}subtitle-${langSuffix || "sub"}.vtt`;

    // Upload para Wasabi
    const putCmd = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: vtt,
      ContentType: "text/vtt; charset=utf-8",
    });

    await wasabiClient.send(putCmd);

    console.log(`[Subtitles] Legenda salva: ${key}`);

    return NextResponse.json({
      ok: true,
      key,
      message: `Legenda salva com sucesso!`,
    });
  } catch (error) {
    console.error("POST /api/subtitles/auto-download error", error);
    return NextResponse.json(
      { error: "Erro ao baixar e salvar legenda." },
      { status: 500 },
    );
  }
}
