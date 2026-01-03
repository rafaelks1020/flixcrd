import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { getSuperflixUrl } from "@/lib/app-settings";

function toStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function toNum(v: any): number | null {
  const n = typeof v === "number" ? v : parseInt(String(v || "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function normalizeCalendarItems(raw: any) {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? (Array.isArray(raw.items) ? raw.items : Array.isArray(raw.data) ? raw.data : Array.isArray(raw.results) ? raw.results : [])
      : [];

  const dedup = new Map<string, any>();
  for (const it of list) {
    if (!it || typeof it !== "object") continue;

    const tmdbId = toNum(pick(it, ["tmdb_id", "tmdbId", "tmdb", "id_tmdb", "id"])) ?? 0;
    const seasonNumber = toNum(pick(it, ["season_number", "seasonNumber", "season", "temporada"])) ?? 0;
    const episodeNumber = toNum(pick(it, ["episode_number", "episodeNumber", "episode", "ep", "episodio"])) ?? 0;
    const airDate = toStr(pick(it, ["air_date", "airDate", "date", "data", "release_date"])) || "";

    const key = `${tmdbId}-${seasonNumber}-${episodeNumber}-${airDate}`;
    if (dedup.has(key)) continue;

    const title = toStr(pick(it, ["title", "name", "nome", "serie", "show"])) || "Sem título";
    const episodeTitle = toStr(pick(it, ["episode_title", "episodeTitle", "episode_name", "episodeName", "titulo_episodio", "nome_episodio"])) || "";
    const status = toStr(pick(it, ["status", "situacao", "state"])) || "";

    const posterPath = toStr(pick(it, ["poster_path", "posterPath", "poster", "poster_url", "posterUrl"])) || "";
    const backdropPath = toStr(pick(it, ["backdrop_path", "backdropPath", "backdrop", "backdrop_url", "backdropUrl"])) || "";

    const imdbId = toStr(pick(it, ["imdb_id", "imdbId", "imdb"])) || "";

    dedup.set(key, {
      title,
      episodeTitle,
      episodeNumber,
      airDate,
      posterPath,
      backdropPath,
      seasonNumber,
      tmdbId,
      imdbId,
      status,
    });
  }

  return Array.from(dedup.values());
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const API_BASE = await getSuperflixUrl();
    const apiUrl = `${API_BASE}/calendario.php`;

    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "FlixCRD-Lab/1.0" },
      next: { revalidate: 120 },
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      return NextResponse.json({ error: "Erro ao consultar calendário externo." }, { status: res.status });
    }

    if (!parsed) {
      return NextResponse.json({ error: "Resposta inválida do calendário (não é JSON)." }, { status: 502 });
    }

    const items = normalizeCalendarItems(parsed);
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error("Lab /calendario proxy error:", err);
    return NextResponse.json({ error: "Erro ao consultar API externa." }, { status: 500 });
  }
}
