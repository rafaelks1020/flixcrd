import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/require-admin";
import { syncHlsReady } from "@/lib/hls-ready";

export const maxDuration = 120;

function bearerOk(request: NextRequest): boolean {
  const expected = (process.env.TRANSCODER_TOKEN ?? "").trim();
  const header = request.headers.get("authorization") ?? "";
  const got = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Atualiza o marcador "pronto para tocar" (hlsReady).
 * Chamado pelo conversor ao terminar um job (Bearer TRANSCODER_TOKEN, body {prefix})
 * e periodicamente sem prefix para conferir tudo. Admin logado também pode chamar.
 */
export async function POST(request: NextRequest) {
  if (!bearerOk(request) && !(await requireAdmin())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let prefix: string | undefined;
  let deep = false;
  try {
    const body = (await request.json()) as { prefix?: unknown; deep?: unknown };
    if (typeof body?.prefix === "string" && body.prefix.trim()) prefix = body.prefix.trim();
    deep = body?.deep === true;
  } catch {
    // sem corpo: confere tudo
  }

  try {
    const result = await syncHlsReady({ prefix, deep });
    return NextResponse.json({ ok: true, prefix: prefix ?? null, ...result });
  } catch (error) {
    console.error("POST /api/hls-ready/sync error", error);
    return NextResponse.json({ error: "Falha ao conferir o storage." }, { status: 500 });
  }
}
