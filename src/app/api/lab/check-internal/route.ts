import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { prisma } from "@/lib/prisma";

/**
 * Verifica se um título do TMDB existe no banco principal (Prisma)
 * Retorna o ID interno se existir
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  const type = searchParams.get("type"); // "movie" ou "tv"
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");

  if (!tmdbId || !type) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const tmdbIdNum = parseInt(tmdbId, 10);
  if (!Number.isFinite(tmdbIdNum)) {
    return NextResponse.json({ error: "tmdbId inválido." }, { status: 400 });
  }

  try {
    // Buscar título pelo TMDB ID
    const titleType = type === "movie" ? "MOVIE" : "SERIES";
    
    const title = await prisma.title.findFirst({
      where: {
        tmdbId: tmdbIdNum,
        type: titleType,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    if (!title) {
      return NextResponse.json({ 
        found: false,
        internalId: null,
        episodeId: null,
      });
    }

    // Se for série e tiver season/episode, buscar o episódio específico
    if (type === "tv" && season && episode) {
      const seasonNum = parseInt(season, 10);
      const episodeNum = parseInt(episode, 10);

      if (Number.isFinite(seasonNum) && Number.isFinite(episodeNum)) {
        const episodeRecord = await prisma.episode.findFirst({
          where: {
            titleId: title.id,
            seasonNumber: seasonNum,
            episodeNumber: episodeNum,
          },
          select: {
            id: true,
          },
        });

        if (episodeRecord) {
          return NextResponse.json({
            found: true,
            internalId: title.id,
            episodeId: episodeRecord.id,
            titleName: title.name,
          });
        }
      }

      // Episódio não encontrado, mas título existe
      return NextResponse.json({
        found: true,
        internalId: title.id,
        episodeId: null,
        titleName: title.name,
      });
    }

    // Filme ou série sem episódio específico
    return NextResponse.json({
      found: true,
      internalId: title.id,
      episodeId: null,
      titleName: title.name,
    });
  } catch (error) {
    console.error("Erro ao verificar título interno:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
