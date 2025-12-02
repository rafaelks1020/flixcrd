import { NextRequest, NextResponse } from "next/server";

const transcoderBaseUrl = process.env.TRANSCODER_BASE_URL;

export async function GET(_request: NextRequest) {
  if (!transcoderBaseUrl) {
    return NextResponse.json(
      { error: "TRANSCODER_BASE_URL não configurado no .env." },
      { status: 500 },
    );
  }

  try {
    const url = `${transcoderBaseUrl.replace(/\/+$/, "")}/jobs`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = (data as any)?.detail ?? (data as any)?.error ?? "Erro ao listar jobs";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/transcode/jobs error", error);
    return NextResponse.json(
      { error: "Erro ao listar jobs de transcodificação." },
      { status: 500 },
    );
  }
}
