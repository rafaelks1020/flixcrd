import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminDenied } from "@/lib/require-admin";
import { claudeConfigured, claudeJson } from "@/lib/ai/claude";

const DetectSchema = z.object({
  season: z.number().int().nullable(),
  episode: z.number().int().nullable(),
});

const SYSTEM = `Você analisa nomes de arquivos de vídeo de séries e anime e extrai temporada e episódio.
Regras:
- Se não houver temporada explícita, use 1.
- Numeração absoluta de anime ("Naruto - 142") vira season 1, episode 142.
- Algarismo romano no nome da série indica a temporada ("Overlord II - 08" = S2E08).
- Ano (1999, 2023) e resolução (720p, 1080p, x264) NÃO são episódio.
- Se não der para identificar o episódio, devolva season e episode nulos.
Exemplos: "Breaking Bad S01E05.mkv" = 1/5; "Game of Thrones 3x09.mp4" = 3/9; "random_video.mp4" = null/null.`;

/**
 * POST /api/admin/detect-episode
 * Body: { filename: string }
 * Usa o Claude para detectar temporada e episódio a partir do nome do arquivo.
 */
export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => null);
    const filename = body?.filename;

    if (!filename || typeof filename !== "string" || filename.length > 500) {
      return NextResponse.json({ error: "filename é obrigatório" }, { status: 400 });
    }

    if (!claudeConfigured()) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, { status: 503 });
    }

    const parsed = await claudeJson({
      schema: DetectSchema,
      system: SYSTEM,
      user: `Nome do arquivo: ${JSON.stringify(filename)}`,
      maxTokens: 1000,
    });

    return NextResponse.json({
      season: parsed.episode !== null ? (parsed.season ?? 1) : null,
      episode: parsed.episode,
      confidence: parsed.episode !== null ? 85 : 0,
    });
  } catch (error) {
    console.error("POST /api/admin/detect-episode error:", error);
    return NextResponse.json({ error: "Erro ao detectar episódio" }, { status: 500 });
  }
}
