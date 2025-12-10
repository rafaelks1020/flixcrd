import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface DetectResult {
  season: number | null;
  episode: number | null;
  confidence: number;
}

/**
 * POST /api/admin/detect-episode
 * Body: { filename: string }
 * 
 * Usa IA (Groq) para detectar temporada e episódio a partir do nome do arquivo
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { filename } = body;

    if (!filename || typeof filename !== "string") {
      return NextResponse.json(
        { error: "filename é obrigatório" },
        { status: 400 }
      );
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY não configurada no servidor" },
        { status: 500 }
      );
    }

    const prompt = `Analise o nome deste arquivo de vídeo e extraia o número da temporada e do episódio.

Nome do arquivo: "${filename}"

Responda APENAS com um JSON no formato:
{"season": <número>, "episode": <número>}

Se não conseguir identificar a temporada, use 1.
Se não conseguir identificar o episódio, retorne {"season": null, "episode": null}

Exemplos:
- "Breaking Bad S01E05.mkv" → {"season": 1, "episode": 5}
- "Naruto - 142.mkv" → {"season": 1, "episode": 142}
- "Game of Thrones 3x09.mp4" → {"season": 3, "episode": 9}
- "Overlord II - 08.mkv" → {"season": 2, "episode": 8}
- "random_video.mp4" → {"season": null, "episode": null}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "Você é um assistente que analisa nomes de arquivos de vídeo e extrai informações de temporada e episódio. Responda APENAS com JSON válido, sem explicações.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", errorText);
      return NextResponse.json(
        { error: "Erro ao chamar API de IA" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "IA não retornou resposta" },
        { status: 500 }
      );
    }

    // Tentar extrair JSON da resposta
    let result: DetectResult = { season: null, episode: null, confidence: 0 };

    try {
      // Procurar por JSON na resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result = {
          season: typeof parsed.season === "number" ? parsed.season : null,
          episode: typeof parsed.episode === "number" ? parsed.episode : null,
          confidence: parsed.episode !== null ? 85 : 0,
        };
      }
    } catch {
      console.error("Erro ao parsear resposta da IA:", content);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/admin/detect-episode error:", error);
    return NextResponse.json(
      { error: "Erro ao detectar episódio" },
      { status: 500 }
    );
  }
}
