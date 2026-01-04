import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { getAppSettings } from "@/lib/app-settings";
import { getAvailableTmdbIds } from "@/lib/superflix";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = parseInt(value || "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";

  console.log(`[Lab Search] Incoming request for query: "${q}"`);

  const user = await getAuthUser(request);

  if (!user?.id) {
    console.warn("[Lab Search] Unauthorized access attempt (no user id)");
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!TMDB_KEY) {
    console.error("[Lab Search] TMDB_API_KEY is missing in environment");
    return NextResponse.json({ error: "TMDB_API_KEY não configurada." }, { status: 500 });
  }

  try {
    const settings = await getAppSettings();
    const includeAdult = !settings.hideAdultContent;

    const page = clampInt(url.searchParams.get("page"), 1, 1, 500);
    const limit = clampInt(url.searchParams.get("limit"), 20, 5, 40);

    if (!q.trim()) {
      return NextResponse.json({ results: [], page, limit, totalPages: 0, scannedPages: 0 });
    }

    // Busca IDs disponíveis usando o utilitário centralizado
    const availableIds = await getAvailableTmdbIds();

    const { performLabSearch } = await import("@/lib/lab-search");
    const { results, totalPages, tmdbPageEnd, hasMore } = await performLabSearch(q, {
      page,
      limit,
      includeAdult,
      availableIds
    });

    const nextPage = hasMore ? tmdbPageEnd + 1 : null;

    // Gerar sugestões se poucos resultados
    const suggestions: string[] = [];
    if (results.length < 3 && q.length > 2) {
      // Sugestões baseadas em correções comuns
      const commonMisspellings: Record<string, string> = {
        "starnger": "stranger",
        "breking": "breaking",
        "avengers": "vingadores",
        "spiderman": "homem aranha",
        "batman": "batman",
        "superman": "superman",
        "starwars": "star wars",
        "gameofthrones": "game of thrones",
        "harrypotter": "harry potter",
      };

      const normalizedSug = q.toLowerCase().replace(/\s+/g, "");
      if (commonMisspellings[normalizedSug]) {
        suggestions.push(commonMisspellings[normalizedSug]);
      }

      // Sugerir termos relacionados se busca for muito específica
      if (q.includes("filme") || q.includes("movie")) {
        suggestions.push(q.replace(/filme|movie/gi, "").trim());
      }
      if (q.includes("série") || q.includes("series")) {
        suggestions.push(q.replace(/série|series/gi, "").trim());
      }

      // Remover duplicatas e filtrar vazios
      const uniqueSuggestions = [...new Set(suggestions)].filter(s => s && s !== q);
      suggestions.length = 0;
      suggestions.push(...uniqueSuggestions.slice(0, 3));
    }

    return NextResponse.json({
      results,
      page,
      limit,
      totalPages,
      scannedPages: tmdbPageEnd - page + 1,
      tmdbPageEnd,
      hasMore,
      nextPage,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      query: q,
    });
  } catch (err) {
    console.error("Lab /busca error:", err);
    return NextResponse.json({ error: "Erro ao consultar busca.", results: [] }, { status: 500 });
  }
}
