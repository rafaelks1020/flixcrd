import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/episodes?titleId=xxx&season=1&episode=1
 * Buscar episódio específico
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const titleId = searchParams.get("titleId");
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");

    if (!titleId || !season || !episode) {
      return NextResponse.json(
        { error: "titleId, season e episode são obrigatórios" },
        { status: 400 }
      );
    }

    const ep = await prisma.episode.findFirst({
      where: {
        titleId,
        seasonNumber: parseInt(season),
        episodeNumber: parseInt(episode),
      },
    });

    if (!ep) {
      return NextResponse.json({ error: "Episódio não encontrado" }, { status: 404 });
    }

    return NextResponse.json(ep);
  } catch (error) {
    console.error("GET /api/episodes error:", error);
    return NextResponse.json({ error: "Erro ao buscar episódio" }, { status: 500 });
  }
}

/**
 * POST /api/episodes
 * Criar episódio (e temporada se não existir)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { titleId, seasonNumber, episodeNumber, name } = body;

    if (!titleId || !seasonNumber || !episodeNumber) {
      return NextResponse.json(
        { error: "titleId, seasonNumber e episodeNumber são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se título existe
    const title = await prisma.title.findUnique({ where: { id: titleId } });
    if (!title) {
      return NextResponse.json({ error: "Título não encontrado" }, { status: 404 });
    }

    // Criar ou buscar temporada
    let season = await prisma.season.findFirst({
      where: { titleId, seasonNumber },
    });

    if (!season) {
      season = await prisma.season.create({
        data: {
          titleId,
          seasonNumber,
          name: `Temporada ${seasonNumber}`,
        },
      });
      console.log(`Temporada ${seasonNumber} criada para título ${titleId}`);
    }

    // Verificar se episódio já existe
    const existingEpisode = await prisma.episode.findFirst({
      where: { titleId, seasonNumber, episodeNumber },
    });

    if (existingEpisode) {
      return NextResponse.json(existingEpisode);
    }

    // Criar episódio
    const episode = await prisma.episode.create({
      data: {
        titleId,
        seasonId: season.id,
        seasonNumber,
        episodeNumber,
        name: name || `Episódio ${episodeNumber}`,
      },
    });

    console.log(`Episódio S${seasonNumber}E${episodeNumber} criado para título ${titleId}`);

    return NextResponse.json(episode, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/episodes error:", error);
    
    // Se for erro de unique constraint, episódio já existe
    if (error.code === "P2002") {
      const existing = await prisma.episode.findFirst({
        where: {
          titleId: error.meta?.target?.[0] === "titleId" ? undefined : undefined,
        },
      });
      if (existing) {
        return NextResponse.json(existing);
      }
    }

    return NextResponse.json({ error: "Erro ao criar episódio" }, { status: 500 });
  }
}
