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
    const isBadVisualizacaoUrl = (url: string) =>
      /imdb\.com|themoviedb\.org|facebook\.com|twitter\.com|wa\.me|t\.me|mailto:|cdn-cgi/i.test(url);

    const visualizacaoMarkdownMatch = html.match(/\[Visualiza[çc][ãa]o\]\(([^)\s]+)\)/i);
    const visualizacaoMarkdownUrl = visualizacaoMarkdownMatch?.[1];

    const anchorMatches = Array.from(
      html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    );

    const anchorCandidates = anchorMatches
      .map((m) => {
        const href = m[1];
        const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return { href, text };
      })
      .filter((c) => !!c.href && !isBadVisualizacaoUrl(c.href));

    const bestAnchor = anchorCandidates
      .map((c) => {
        let score = 0;
        if (/visualiza/i.test(c.text)) score += 100;
        if (/assistir|play|player|watch|embed/i.test(c.text)) score += 30;
        if (/\/(play|assistir|watch|player|embed)(\/|\b)/i.test(c.href)) score += 30;
        if (/^https?:\/\//i.test(c.href)) score += 10;
        return { ...c, score };
      })
      .sort((a, b) => b.score - a.score)[0];

    const visualizacaoFallbackUrlMatch = (html.match(/https?:\/\/(?!superflixapi\.run)[^\s"'<>]+/gi) || [])
      .filter((u) => !isBadVisualizacaoUrl(u))[0];

    const visualizacaoUrlRaw =
      (visualizacaoMarkdownUrl && !isBadVisualizacaoUrl(visualizacaoMarkdownUrl)
        ? visualizacaoMarkdownUrl
        : undefined) ||
      bestAnchor?.href ||
      visualizacaoFallbackUrlMatch;

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
    const extractVideoId = (content: string): { videoId?: string; followUrl?: string } => {
      const iframeLike = content.match(/<(?:iframe|div)[^>]*(?:src|data-src|data-embed)=["']([^"']+)["']/i);
      const iframeSrc = iframeLike?.[1];

      if (iframeSrc) {
        const abs = iframeSrc.startsWith("http")
          ? iframeSrc
          : iframeSrc.startsWith("//")
            ? `https:${iframeSrc}`
            : new URL(iframeSrc, SUPERFLIX_BASE).toString();

        const after = abs.split("/stape/")[1];
        const byPath = after ? after.split(/[?#]/)[0] : undefined;
        if (byPath) return { videoId: byPath };

        const byQuery = abs.match(/stape[^\s"']*[?&]id=([^&"'<>\s]+)/i)?.[1];
        if (byQuery) return { videoId: byQuery };

        if (/^https?:\/\//i.test(abs)) {
          return { followUrl: abs };
        }
      }

      const byPathAny = content.match(/\/stape\/([^\s"'?#&<>]+)/i)?.[1];
      if (byPathAny) return { videoId: byPathAny };

      const byQueryAny = content.match(/stape[^\s"']*[?&]id=([^&"'<>\s]+)/i)?.[1];
      if (byQueryAny) return { videoId: byQueryAny };

      return {};
    };

    const visHost = new URL(visualizacaoUrl).host;
    const allowedHosts = new Set(["superflixapi.run", visHost]);

    const normalizeUrl = (raw: string, base: string) => {
      try {
        if (raw.startsWith("//")) return `https:${raw}`;
        return new URL(raw, base).toString();
      } catch {
        return null;
      }
    };

    const collectCandidateUrls = (content: string, base: string) => {
      const urls: string[] = [];
      const attrMatches = Array.from(
        content.matchAll(/(?:href|src|data-src|data-embed)=["']([^"']+)["']/gi)
      ).map((m) => m[1]);

      for (const raw of attrMatches) {
        const abs = normalizeUrl(raw, base);
        if (!abs) continue;
        const host = new URL(abs).host;
        if (!allowedHosts.has(host)) continue;
        if (/imdb\.com|themoviedb\.org|facebook\.com|twitter\.com|wa\.me|t\.me|cdn-cgi/i.test(abs)) continue;
        urls.push(abs);
      }

      const unique = Array.from(new Set(urls));
      const scored = unique
        .map((u) => {
          let score = 0;
          if (/\/stape\//i.test(u)) score += 200;
          if (/stape[^\s"']*[?&]id=/i.test(u)) score += 180;
          if (/\/(play|assistir|watch|player|embed|stream)(\/|\b)/i.test(u)) score += 80;
          if (/superflixapi\.run/i.test(u)) score += 30;
          return { u, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.u);

      return scored.slice(0, 5);
    };

    const initial1 = extractVideoId(playerPageHtml);
    const initial2 = extractVideoId(html);
    let videoId: string | undefined = initial1.videoId || initial2.videoId;

    const followFirst = initial1.followUrl || initial2.followUrl;
    if (!videoId && followFirst) {
      const abs = normalizeUrl(followFirst, visualizacaoUrl);
      if (abs) {
        const host = new URL(abs).host;
        if (allowedHosts.has(host)) {
          const nestedRes = await fetch(abs, {
            headers: {
              "User-Agent": "FlixCRD-Lab/1.0",
              Referer: visualizacaoUrl,
            },
          });
          if (nestedRes.ok) {
            const nestedHtml = await nestedRes.text();
            videoId = extractVideoId(nestedHtml).videoId;
          }
        }
      }
    }

    if (!videoId) {
      const candidates = [
        ...collectCandidateUrls(playerPageHtml, visualizacaoUrl),
        ...collectCandidateUrls(html, upstreamUrl),
      ];

      for (const u of Array.from(new Set(candidates)).slice(0, 5)) {
        const nestedRes = await fetch(u, {
          headers: {
            "User-Agent": "FlixCRD-Lab/1.0",
            Referer: visualizacaoUrl,
          },
        });
        if (!nestedRes.ok) continue;
        const nestedHtml = await nestedRes.text();
        const nested = extractVideoId(nestedHtml);
        if (nested.videoId) {
          videoId = nested.videoId;
          break;
        }
      }
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
