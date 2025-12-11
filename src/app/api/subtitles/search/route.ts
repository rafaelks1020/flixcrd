import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface SubtitleResult {
  id: string;
  language: string;
  fileName: string;
  downloadCount: number;
  rating: number;
  release: string;
  uploader: string;
  url: string;
  fileId: number | string;
  source: string;
}

interface OpenSubtitlesFile {
  file_id: number;
  cd_number: number;
  file_name: string;
}

interface OpenSubtitlesItem {
  id: string;
  attributes: {
    subtitle_id: string;
    language: string;
    download_count: number;
    ratings: number;
    release: string;
    uploader: {
      name: string;
    };
    url: string;
    files: OpenSubtitlesFile[];
  };
}

interface OpenSubtitlesResponse {
  total_count: number;
  data: OpenSubtitlesItem[];
}

/**
 * Buscar legendas - OpenSubtitles ou Subdl
 * GET /api/subtitles/search?tmdbId=123&type=movie&season=1&episode=1&name=Overlord
 */
export async function GET(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tmdbId = searchParams.get("tmdbId");
    const type = searchParams.get("type") || "movie";
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");
    const name = searchParams.get("name");
    const language = searchParams.get("language") || "pt-BR";

    const allSubtitles: SubtitleResult[] = [];
    const errors: string[] = [];

    // 1. Tentar OpenSubtitles se tiver API Key
    const apiKey = process.env.OPENSUBTITLES_API_KEY;
    if (apiKey && tmdbId) {
      try {
        console.log("[Subtitles] Buscando no OpenSubtitles...");
        const subtitles = await searchOpenSubtitles(apiKey, tmdbId, type, season, episode, language);
        console.log(`[Subtitles] OpenSubtitles: ${subtitles.length} resultados`);
        allSubtitles.push(...subtitles);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error("[Subtitles] OpenSubtitles error:", errMsg);
        errors.push(`OpenSubtitles: ${errMsg}`);
      }
    } else {
      console.log("[Subtitles] OpenSubtitles: API Key não configurada");
      errors.push("OpenSubtitles: API Key não configurada (OPENSUBTITLES_API_KEY)");
    }

    // 2. Adicionar links de busca em sites populares de legendas
    if (name) {
      const searchLinks = createSubtitleSearchLinks(name, type, season, episode);
      allSubtitles.push(...searchLinks);
    }

    console.log(`[Subtitles] Total: ${allSubtitles.length} legendas encontradas`);

    return NextResponse.json({
      total: allSubtitles.length,
      subtitles: allSubtitles,
    });
  } catch (error: any) {
    console.error("Erro ao buscar legendas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar legendas", details: error.message },
      { status: 500 }
    );
  }
}

// OpenSubtitles API
async function searchOpenSubtitles(
  apiKey: string,
  tmdbId: string,
  type: string,
  season: string | null,
  episode: string | null,
  language: string
): Promise<SubtitleResult[]> {
  const params = new URLSearchParams({
    tmdb_id: tmdbId,
    type: type === "SERIES" || type === "ANIME" ? "episode" : "movie",
    languages: language.replace("-", "_").toLowerCase(),
  });

  if ((type === "SERIES" || type === "ANIME") && season && episode) {
    params.append("season_number", season);
    params.append("episode_number", episode);
  }

  const url = `https://api.opensubtitles.com/api/v1/subtitles?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "User-Agent": "FlixCRD v1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`OpenSubtitles API error: ${response.status}`);
  }

  const text = await response.text();
  if (!text || text.trim() === "") {
    return [];
  }

  let data: OpenSubtitlesResponse;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("OpenSubtitles: Invalid JSON response");
    return [];
  }

  if (!data.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((item) => ({
    id: `os-${item.attributes.subtitle_id}`,
    language: item.attributes.language,
    fileName: item.attributes.files[0]?.file_name || "subtitle.srt",
    downloadCount: item.attributes.download_count,
    rating: item.attributes.ratings || 0,
    release: item.attributes.release || "",
    uploader: item.attributes.uploader?.name || "Unknown",
    url: item.attributes.url,
    fileId: item.attributes.files[0]?.file_id || 0,
    source: "OpenSubtitles",
  }));
}

// Subdl API (gratuito)
async function searchSubdl(
  name: string,
  type: string,
  season: string | null,
  episode: string | null,
  language: string
): Promise<SubtitleResult[]> {
  // Subdl usa códigos de idioma diferentes
  const langCode = language === "pt-BR" ? "pt" : language.split("-")[0];
  
  let query = name;
  if ((type === "SERIES" || type === "ANIME") && season && episode) {
    query = `${name} S${season.padStart(2, "0")}E${episode.padStart(2, "0")}`;
  }

  const url = `https://api.subdl.com/api/v1/subtitles?query=${encodeURIComponent(query)}&languages=${langCode}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "FlixCRD v1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Subdl API error: ${response.status}`);
  }

  const text = await response.text();
  if (!text || text.trim() === "") {
    return [];
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("Subdl: Invalid JSON response");
    return [];
  }

  if (!data.subtitles || !Array.isArray(data.subtitles)) {
    return [];
  }

  return data.subtitles.slice(0, 10).map((item: any, index: number) => ({
    id: `subdl-${index}-${Date.now()}`,
    language: item.language || langCode,
    fileName: item.release_name || "subtitle.srt",
    downloadCount: item.download_count || 0,
    rating: 0,
    release: item.release_name || "",
    uploader: item.author || "Subdl",
    url: item.url || "",
    fileId: item.url || "",
    source: "Subdl",
  }));
}

// Criar links de busca para sites populares de legendas
function createSubtitleSearchLinks(
  name: string,
  type: string,
  season: string | null,
  episode: string | null
): SubtitleResult[] {
  let query = name;
  let episodeQuery = "";
  
  if ((type === "SERIES" || type === "ANIME") && season && episode) {
    episodeQuery = `S${season.padStart(2, "0")}E${episode.padStart(2, "0")}`;
    query = `${name} ${episodeQuery}`;
  }

  const sites = [
    {
      name: "OpenSubtitles.org",
      url: `https://www.opensubtitles.org/pb/search/sublanguageid-pob/moviename-${encodeURIComponent(query)}`,
      icon: "🎬",
    },
    {
      name: "Subscene",
      url: `https://subscene.com/subtitles/searchbytitle?query=${encodeURIComponent(name)}`,
      icon: "📺",
    },
    {
      name: "Addic7ed",
      url: `https://www.addic7ed.com/search.php?search=${encodeURIComponent(name)}&Submit=Search`,
      icon: "🎭",
    },
    {
      name: "YIFY Subtitles",
      url: `https://yifysubtitles.org/search?q=${encodeURIComponent(name)}`,
      icon: "🎥",
    },
    {
      name: "Google",
      url: `https://www.google.com/search?q=${encodeURIComponent(query + " legenda portugues download")}`,
      icon: "🔍",
    },
  ];

  return sites.map((site, index) => ({
    id: `search-${site.name.toLowerCase().replace(/\s/g, "-")}-${Date.now()}-${index}`,
    language: "pt-BR",
    fileName: `${site.icon} Buscar em ${site.name}`,
    downloadCount: 0,
    rating: 0,
    release: episodeQuery || name,
    uploader: site.name,
    url: site.url,
    fileId: site.url,
    source: "Busca Externa",
  }));
}
