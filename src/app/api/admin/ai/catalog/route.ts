import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/require-admin";
import { CLAUDE_MODEL, claudeConfigured, claudeJson } from "@/lib/ai/claude";

export const dynamic = "force-dynamic";

const CatalogSchema = z.object({
  overview: z.string(),
  tagline: z.string().nullable(),
  tags: z.array(z.string()),
});

const TaglineSchema = z.object({ tagline: z.string() });

const SYSTEM_CATALOG =
  "Você faz curadoria de catálogo de streaming. Escreva em pt-BR. A sinopse deve ser objetiva e chamativa, sem spoilers, com no máximo uns 500 caracteres. A tagline é curta (até uns 90 caracteres). As tags são curtas (1 ou 2 palavras), no máximo 12. Se não conhecer o título, baseie-se só nos dados recebidos e não invente elenco nem fatos.";

const SYSTEM_TAGLINE =
  "Você faz curadoria de catálogo de streaming. Gere uma tagline em pt-BR, curta (até uns 90 caracteres), chamativa e sem spoilers.";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    if (!claudeConfigured()) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, originalName, type, releaseDate, tmdbId, overview, language, task } = body ?? {};

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Campo obrigatório: name" }, { status: 400 });
    }

    const normalizedTask = typeof task === "string" ? task.trim().toLowerCase() : "catalog";
    const isTaglineTask = normalizedTask === "tagline";

    const userPayload = {
      name: name.slice(0, 300),
      originalName: typeof originalName === "string" ? originalName.slice(0, 300) : null,
      type: typeof type === "string" ? type : null,
      releaseDate: typeof releaseDate === "string" ? releaseDate : null,
      tmdbId: typeof tmdbId === "number" ? tmdbId : null,
      overview: typeof overview === "string" ? overview.slice(0, 4000) : null,
      language: typeof language === "string" ? language : "pt-BR",
    };

    if (isTaglineTask) {
      const out = await claudeJson({
        schema: TaglineSchema,
        system: SYSTEM_TAGLINE,
        user: `Título: ${JSON.stringify(userPayload)}`,
        maxTokens: 1000,
      });
      return NextResponse.json({
        overview: "",
        tagline: out.tagline,
        tags: [],
        model: CLAUDE_MODEL,
        task: normalizedTask,
      });
    }

    const out = await claudeJson({
      schema: CatalogSchema,
      system: SYSTEM_CATALOG,
      user: `Gere sinopse, tagline e tags para este título: ${JSON.stringify(userPayload)}`,
      maxTokens: 2000,
    });

    return NextResponse.json({
      overview: out.overview,
      tagline: out.tagline,
      tags: out.tags.slice(0, 12),
      model: CLAUDE_MODEL,
      task: normalizedTask,
    });
  } catch (error) {
    console.error("POST /api/admin/ai/catalog error", error);
    return NextResponse.json({ error: "Erro ao gerar conteúdo com IA." }, { status: 500 });
  }
}
