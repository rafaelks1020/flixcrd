import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth";

import { getAuthUser } from "@/lib/auth-mobile";
import { authOptions } from "@/lib/auth";

const SUPERFLIX_BASE = "https://superflixapi.run";

export async function GET(request: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  const sessionUserId = session?.user?.id as string | undefined;
  const sessionRole = session?.user?.role as string | undefined;

  const bearerUser = sessionUserId ? null : await getAuthUser(request);
  const userId = sessionUserId || bearerUser?.id;
  const role = sessionRole || bearerUser?.role;

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const enabled = role === "ADMIN" || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "filme" ou "serie"
  const id = searchParams.get("id"); // IMDb ID (filme) ou TMDB ID (série)
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");

  if (!type || !id) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  try {
    let upstreamUrl = `${SUPERFLIX_BASE}/${type}/${id}`;

    if (type === "serie" && season && episode) {
      upstreamUrl += `/${season}/${episode}`;
    }

    const res = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "FlixCRD-Lab/1.0",
        Referer: "https://superflixapi.run/",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Erro ao buscar vídeo." }, { status: res.status });
    }

    const html = await res.text();

    // Extrair o link de "Visualização" que aponta para o player real
    // Exemplo: <a href="https://pobreflix.casa/filme/...">Visualização</a>
    const visualizacaoMatch = html.match(
      /<a[^>]*href=["']([^"']+)["'][^>]*>Visualiza[çc][ãa]o<\/a>/i
    );

    if (!visualizacaoMatch) {
      return NextResponse.json({ error: "Link de visualização não encontrado." }, { status: 404 });
    }

    const visualizacaoUrl = visualizacaoMatch[1];

    // Buscar a página de visualização para extrair o iframe do player Streamtape
    const playerPageRes = await fetch(visualizacaoUrl, {
      headers: {
        "User-Agent": "FlixCRD-Lab/1.0",
        Referer: upstreamUrl,
      },
    });

    if (!playerPageRes.ok) {
      return NextResponse.json({ error: "Erro ao buscar página do player." }, { status: playerPageRes.status });
    }

    const playerPageHtml = await playerPageRes.text();

    // Extrair o src do iframe que aponta para /stape/VIDEO_ID
    // Exemplo: <iframe src="https://superflixapi.run/stape/VIDEO_ID?..."></iframe>
    const iframeMatch = playerPageHtml.match(
      /<iframe[^>]*src=["']([^"']*\/stape\/[^"'?]+)([^"']*)["']/i
    );

    if (!iframeMatch) {
      return NextResponse.json({ error: "Player Streamtape não encontrado." }, { status: 404 });
    }

    const stapeUrl = iframeMatch[1];
    const videoId = stapeUrl.split("/stape/")[1];

    if (!videoId) {
      return NextResponse.json({ error: "ID do vídeo não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      videoId,
      stapeUrl: `/stape/${videoId}`,
    });
  } catch (error) {
    console.error("Erro ao buscar video-id:", error);
    return NextResponse.json({ error: "Erro interno ao buscar vídeo." }, { status: 500 });
  }
}
