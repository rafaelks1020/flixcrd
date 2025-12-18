import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";

const TMDB_API = "https://api.themoviedb.org/3";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const enabled = user.role === "ADMIN" || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const TMDB_KEY = process.env.TMDB_API_KEY || "";
  if (!TMDB_KEY) {
    return NextResponse.json({ error: "TMDB_API_KEY não configurada." }, { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const type = (url.searchParams.get("type") || "movie").toLowerCase();

    const tmdbType = type === "tv" || type === "series" || type === "serie" || type === "anime" ? "tv" : "movie";

    const tmdbUrl = `${TMDB_API}/genre/${tmdbType}/list?api_key=${TMDB_KEY}&language=pt-BR`;
    const res = await fetch(tmdbUrl, { next: { revalidate: 86400 } });

    if (!res.ok) {
      return NextResponse.json({ error: "Falha ao consultar gêneros do TMDB." }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Lab /tmdb/genres error:", err);
    return NextResponse.json({ error: "Erro ao carregar gêneros." }, { status: 500 });
  }
}
