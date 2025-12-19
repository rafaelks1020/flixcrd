import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session: any = await getServerSession(authOptions as any);

  if (!session || !session.user || (session.user as any).role !== "ADMIN") {
    return { isAdmin: false };
  }

  return { isAdmin: true };
}

function safeJsonParse(input: string): any | null {
  const trimmed = input.trim();

  const withoutFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    // ignore
  }

  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = withoutFences.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY não configurado." },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      name,
      originalName,
      type,
      releaseDate,
      tmdbId,
      overview,
      language,
      task,
      model: modelFromBody,
    } = body ?? {};

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Campo obrigatório: name" },
        { status: 400 },
      );
    }

    const normalizedTask = typeof task === "string" ? task.trim().toLowerCase() : "catalog";
    const isTaglineTask = normalizedTask === "tagline";

    const defaultModelCatalog = "deepseek/deepseek-chat-v3-0324";
    const defaultModelTagline = defaultModelCatalog;

    const requestedModel = typeof modelFromBody === "string" ? modelFromBody.trim() : "";
    const envModelByTask = isTaglineTask
      ? ((process.env.OPENROUTER_MODEL_TAGLINE as string | undefined) ?? "")
      : ((process.env.OPENROUTER_MODEL_CATALOG as string | undefined) ?? "");
    const envModel = (process.env.OPENROUTER_MODEL as string | undefined) ?? "";

    const defaultModel = isTaglineTask ? defaultModelTagline : defaultModelCatalog;
    const primaryModel = (requestedModel || envModelByTask || envModel || defaultModel).trim();

    const userPayload = {
      name,
      originalName: typeof originalName === "string" ? originalName : null,
      type: typeof type === "string" ? type : null,
      releaseDate: typeof releaseDate === "string" ? releaseDate : null,
      tmdbId: typeof tmdbId === "number" ? tmdbId : null,
      overview: typeof overview === "string" ? overview : null,
      language: typeof language === "string" ? language : "pt-BR",
    };

    const systemPrompt = isTaglineTask
      ? "Você é um assistente para curadoria de catálogo de streaming. Responda SEMPRE em JSON puro, sem markdown, no formato: {\"tagline\": string}. A tagline deve ser em pt-BR, curta (até ~90 caracteres), chamativa e sem spoilers."
      : "Você é um assistente para curadoria de catálogo de streaming. Responda SEMPRE em JSON puro, sem markdown, no formato: {\"overview\": string, \"tagline\": string|null, \"tags\": string[]}. A sinopse deve ser em pt-BR, objetiva e chamativa, sem spoilers, com no máximo ~500 caracteres. As tags devem ser curtas (1-2 palavras), em pt-BR.";

    const userPrompt = isTaglineTask
      ? `Gere APENAS uma tagline para este título: ${JSON.stringify(userPayload)}`
      : `Gere sinopse e tags para este título: ${JSON.stringify(userPayload)}`;

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    async function callOpenRouter(model: string) {
      const upstreamRes = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.4,
            max_tokens: 500,
          }),
        },
      );

      const upstreamJson = await upstreamRes.json().catch(() => null);

      const upstreamError =
        upstreamJson?.error?.message ||
        upstreamJson?.error ||
        upstreamJson?.message ||
        "Erro ao chamar OpenRouter";

      return {
        ok: upstreamRes.ok,
        upstreamJson,
        upstreamError: typeof upstreamError === "string" ? upstreamError : String(upstreamError),
      };
    }

    const candidates = [
      primaryModel,
      primaryModel.endsWith(":free") ? primaryModel.replace(/:free$/, "") : `${primaryModel}:free`,
      defaultModel,
      "deepseek/deepseek-chat-v3",
    ].filter((m, idx, arr) => typeof m === "string" && m.trim() && arr.indexOf(m) === idx);

    let attemptModel = candidates[0];
    let attempt = await callOpenRouter(attemptModel);

    if (!attempt.ok && /no endpoints found/i.test(attempt.upstreamError)) {
      for (const candidate of candidates.slice(1)) {
        attemptModel = candidate;
        attempt = await callOpenRouter(candidate);
        if (attempt.ok || !/no endpoints found/i.test(attempt.upstreamError)) {
          break;
        }
      }
    }

    if (!attempt.ok) {
      return NextResponse.json(
        {
          error: "Falha ao gerar conteúdo com IA.",
          upstreamError: attempt.upstreamError,
          modelTried: attemptModel,
        },
        { status: 502 },
      );
    }

    const content =
      attempt.upstreamJson?.choices?.[0]?.message?.content ??
      attempt.upstreamJson?.choices?.[0]?.text ??
      "";

    const contentText = typeof content === "string" ? content : "";
    const parsed = typeof content === "string" ? safeJsonParse(content) : null;

    const tags = Array.isArray(parsed?.tags)
      ? parsed.tags.filter((t: any) => typeof t === "string").slice(0, 12)
      : [];

    const overviewResult = isTaglineTask
      ? typeof parsed?.overview === "string"
        ? parsed.overview
        : ""
      : typeof parsed?.overview === "string"
        ? parsed.overview
        : contentText;

    const taglineResult = typeof parsed?.tagline === "string"
      ? parsed.tagline
      : isTaglineTask
        ? (contentText.trim() ? contentText.trim() : null)
        : null;

    const result = {
      overview: overviewResult,
      tagline: taglineResult,
      tags,
      model: attemptModel,
      task: normalizedTask,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/admin/ai/catalog error", error);
    return NextResponse.json(
      { error: "Erro ao gerar conteúdo com IA." },
      { status: 500 },
    );
  }
}
