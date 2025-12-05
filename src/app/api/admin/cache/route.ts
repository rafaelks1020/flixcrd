import { NextRequest, NextResponse } from "next/server";
import {
  purgeAllCache,
  purgeBatch,
  warmTitle,
  warmEpisode,
  refreshTitleCache,
  generateHlsUrls,
} from "@/lib/cloudflare-cache";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/cache
 * Retorna status do cache de um título
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { error: "Parâmetro 'slug' é obrigatório" },
      { status: 400 }
    );
  }

  try {
    // Buscar título
    const title = await prisma.title.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, type: true },
    });

    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado" },
        { status: 404 }
      );
    }

    // Gerar URLs que deveriam estar cacheadas
    const urls = generateHlsUrls(slug, 10); // Apenas primeiros 10 para teste rápido

    // Testar algumas URLs
    const testResults = await Promise.all(
      urls.slice(0, 5).map(async (url) => {
        try {
          const res = await fetch(url, { method: "HEAD" });
          return {
            url,
            cached: res.headers.get("cf-cache-status") === "HIT",
            status: res.headers.get("cf-cache-status"),
          };
        } catch {
          return { url, cached: false, status: "error" };
        }
      })
    );

    return NextResponse.json({
      title: title.name,
      slug: title.slug,
      type: title.type,
      cacheStatus: testResults,
      summary: {
        total: testResults.length,
        cached: testResults.filter((r) => r.cached).length,
        notCached: testResults.filter((r) => !r.cached).length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/cache error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao verificar cache" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cache
 * Gerencia cache: purge, warmup, refresh
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, slug, seasonNumber, episodeNumber, segmentCount = 100 } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Parâmetro 'action' é obrigatório" },
        { status: 400 }
      );
    }

    switch (action) {
      // ========================================
      // PURGE ALL - Limpa TODO o cache
      // ========================================
      case "purge_all": {
        const result = await purgeAllCache();
        return NextResponse.json({
          success: result.success,
          message: result.success
            ? "Cache completo limpo com sucesso!"
            : "Erro ao limpar cache",
          errors: result.errors,
        });
      }

      // ========================================
      // PURGE TITLE - Limpa cache de um título
      // ========================================
      case "purge_title": {
        if (!slug) {
          return NextResponse.json(
            { error: "Parâmetro 'slug' é obrigatório para purge_title" },
            { status: 400 }
          );
        }

        const urls = generateHlsUrls(slug, segmentCount);
        const results = await purgeBatch(urls);
        const success = results.every((r) => r.success);

        return NextResponse.json({
          success,
          message: success
            ? `Cache de "${slug}" limpo com sucesso!`
            : "Erro ao limpar cache",
          urlsCleared: urls.length,
        });
      }

      // ========================================
      // WARMUP TITLE - Pré-aquece cache de um título
      // ========================================
      case "warmup_title": {
        if (!slug) {
          return NextResponse.json(
            { error: "Parâmetro 'slug' é obrigatório para warmup_title" },
            { status: 400 }
          );
        }

        const result = await warmTitle(slug, segmentCount);

        return NextResponse.json({
          success: result.errors === 0,
          message: `Cache de "${slug}" pré-aquecido!`,
          stats: {
            total: result.success + result.errors,
            success: result.success,
            errors: result.errors,
          },
        });
      }

      // ========================================
      // WARMUP EPISODE - Pré-aquece cache de um episódio
      // ========================================
      case "warmup_episode": {
        if (!slug || !seasonNumber || !episodeNumber) {
          return NextResponse.json(
            {
              error:
                "Parâmetros 'slug', 'seasonNumber' e 'episodeNumber' são obrigatórios",
            },
            { status: 400 }
          );
        }

        const result = await warmEpisode(
          slug,
          seasonNumber,
          episodeNumber,
          segmentCount
        );

        return NextResponse.json({
          success: result.errors === 0,
          message: `Cache de "${slug}" S${seasonNumber}E${episodeNumber} pré-aquecido!`,
          stats: {
            total: result.success + result.errors,
            success: result.success,
            errors: result.errors,
          },
        });
      }

      // ========================================
      // REFRESH TITLE - Purge + Warmup
      // ========================================
      case "refresh_title": {
        if (!slug) {
          return NextResponse.json(
            { error: "Parâmetro 'slug' é obrigatório para refresh_title" },
            { status: 400 }
          );
        }

        const result = await refreshTitleCache(slug, segmentCount);

        return NextResponse.json({
          success: result.purged && result.warmed.errors === 0,
          message: `Cache de "${slug}" atualizado!`,
          stats: {
            purged: result.purged,
            warmed: result.warmed,
          },
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Ação '${action}' não reconhecida`,
            validActions: [
              "purge_all",
              "purge_title",
              "warmup_title",
              "warmup_episode",
              "refresh_title",
            ],
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("POST /api/admin/cache error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao gerenciar cache" },
      { status: 500 }
    );
  }
}
