import { NextResponse } from "next/server";
import { adminDenied } from "@/lib/require-admin";

const transcoderBaseUrl = process.env.TRANSCODER_BASE_URL;

function getTranscoderAuthHeaders(): Record<string, string> {
  const token = process.env.TRANSCODER_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;

  if (!transcoderBaseUrl) {
    return NextResponse.json(
      { error: "TRANSCODER_BASE_URL não configurado no .env." },
      { status: 500 },
    );
  }

  try {
    const url = `${transcoderBaseUrl.replace(/\/+$/, "")}/workers`;
    const res = await fetch(url, {
      headers: getTranscoderAuthHeaders(),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as
      | { detail?: string; error?: string }
      | null;

    if (!res.ok) {
      const message = data?.detail ?? data?.error ?? "Erro ao listar workers";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/transcode/workers error", error);
    return NextResponse.json(
      { error: "Erro ao listar workers de transcodificação." },
      { status: 500 },
    );
  }
}
