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
  const type = searchParams.get("type") || searchParams.get("type_"); // "filme" ou "serie"
  const id = searchParams.get("id") || searchParams.get("id_"); // IMDb ID (filme) ou TMDB ID (série)
  const season = searchParams.get("season") || searchParams.get("season_");
  const episode = searchParams.get("episode") || searchParams.get("episode_");

  if (!type || !id) {
    return NextResponse.json(
      {
        error: "Parâmetros inválidos. Informe type e id.",
      },
      { status: 400 }
    );
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
    const visualizacaoMarkdownMatch = html.match(
      /\[Visualiza[çc][ãa]o\]\((https?:\/\/[^)\s]+)\)/i
    );

    const visualizacaoAnchorMatch = html.match(
      /<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?Visualiza[çc][ãa]o[\s\S]*?<\/a>/i
    );

    const visualizacaoFallbackUrlMatch = html.match(
      /https?:\/\/(?!superflixapi\.run)[^\s"'<>]+/i
    );

    const visualizacaoUrlRaw =
      visualizacaoMarkdownMatch?.[1] ||
      visualizacaoAnchorMatch?.[1] ||
      visualizacaoFallbackUrlMatch?.[0];

    if (!visualizacaoUrlRaw) {
      return NextResponse.json({ error: "Link de visualização não encontrado." }, { status: 404 });
    }

    const visualizacaoUrl = new URL(visualizacaoUrlRaw, upstreamUrl).toString();

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
    // Exemplo: <iframe src="https://superflixapi.run/stape/VIDEO_ID?...">></iframe>
    const iframeMatch = playerPageHtml.match(/<iframe[^>]*src=["']([^"']+)["']/i);
    const iframeSrc = iframeMatch?.[1];

    let videoId: string | undefined;

    if (iframeSrc) {
      const iframeAbs = iframeSrc.startsWith("http")
        ? iframeSrc
        : new URL(iframeSrc, SUPERFLIX_BASE).toString();
      const after = iframeAbs.split("/stape/")[1];
      videoId = after ? after.split(/[?#]/)[0] : undefined;
    }

    if (!videoId) {
      const stapeAnyMatch = playerPageHtml.match(/\/stape\/([^\s"'?#&<>]+)/i);
      videoId = stapeAnyMatch?.[1];
    }

    if (!videoId) {
      const stapeAnyMatchUpstream = html.match(/\/stape\/([^\s"'?#&<>]+)/i);
      videoId = stapeAnyMatchUpstream?.[1];
    }

    if (!videoId) {
      return NextResponse.json({ error: "Player Streamtape não encontrado." }, { status: 404 });
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
