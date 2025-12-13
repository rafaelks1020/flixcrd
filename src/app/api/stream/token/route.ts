import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { generateStreamToken, isProtectedStreamingEnabled } from "@/lib/stream-token";
import { prisma } from "@/lib/prisma";

/**
 * API para gerar tokens de streaming protegidos
 * 
 * POST /api/stream/token
 * Body: { contentType: "title" | "episode", contentId: string }
 * 
 * Retorna: { streamUrl, expiresAt } ou fallback para URL antiga
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    // 2. Verificar assinatura do usuário
    const userId = authUser.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { Subscription: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    // Verificar se pode assistir (admin ou assinatura ativa)
    const isAdmin = user.role === "ADMIN";
    const now = new Date();
    const hasActiveSubscription = Boolean(
      user.Subscription &&
        user.Subscription.status === "ACTIVE" &&
        user.Subscription.currentPeriodEnd &&
        user.Subscription.currentPeriodEnd > now,
    );
    
    if (!isAdmin && !hasActiveSubscription) {
      return NextResponse.json(
        { error: "Assinatura necessária para assistir." },
        { status: 403 }
      );
    }

    // 3. Parsear body
    const body = await request.json();
    const { contentType, contentId } = body;

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: "contentType e contentId são obrigatórios." },
        { status: 400 }
      );
    }

    // 4. Buscar o conteúdo e seu hlsPath
    let hlsPath: string | null = null;
    let titleInfo: any = null;

    if (contentType === "title") {
      const title = await prisma.title.findUnique({ where: { id: contentId } });
      if (!title) {
        return NextResponse.json(
          { error: "Título não encontrado." },
          { status: 404 }
        );
      }
      hlsPath = title.hlsPath;
      titleInfo = {
        id: title.id,
        name: title.name,
        type: title.type,
      };
    } else if (contentType === "episode") {
      const episode = await prisma.episode.findUnique({
        where: { id: contentId },
        include: { Title: true },
      });
      if (!episode) {
        return NextResponse.json(
          { error: "Episódio não encontrado." },
          { status: 404 }
        );
      }
      hlsPath = episode.hlsPath;
      titleInfo = {
        id: episode.Title?.id,
        name: episode.Title?.name,
        type: episode.Title?.type,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeName: episode.name,
      };
    } else {
      return NextResponse.json(
        { error: "contentType inválido. Use 'title' ou 'episode'." },
        { status: 400 }
      );
    }

    if (!hlsPath) {
      return NextResponse.json(
        { error: "Conteúdo não possui caminho HLS configurado." },
        { status: 400 }
      );
    }

    // 5. Gerar token via Worker (se configurado)
    if (isProtectedStreamingEnabled()) {
      // Remove trailing slash para o contentId
      const cleanPath = hlsPath.endsWith("/") ? hlsPath.slice(0, -1) : hlsPath;
      
      const tokenData = await generateStreamToken(cleanPath, "wasabi");
      
      if (tokenData) {
        return NextResponse.json({
          streamUrl: tokenData.streamUrl,
          expiresAt: tokenData.expiresAt,
          protected: true,
          title: titleInfo,
        });
      }
      
      // Se falhou, log e fallback
      console.warn("[stream/token] Falha ao gerar token, usando fallback");
    }

    // 6. Fallback: usar API antiga (sem proteção)
    const fallbackUrl = contentType === "title"
      ? `/api/titles/${contentId}/hls`
      : `/api/episodes/${contentId}/hls`;

    return NextResponse.json({
      streamUrl: fallbackUrl,
      expiresAt: null,
      protected: false,
      title: titleInfo,
    });

  } catch (error) {
    console.error("POST /api/stream/token error:", error);
    return NextResponse.json(
      { error: "Erro ao gerar token de streaming." },
      { status: 500 }
    );
  }
}
