import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json();
    const { titleId, seasonNumber, episodes } = body as {
      titleId: string;
      seasonNumber: number;
      episodes: Array<{
        episodeNumber: number;
        name: string;
        overview?: string;
      }>;
    };

    if (!titleId || !seasonNumber || !Array.isArray(episodes) || episodes.length === 0) {
      return NextResponse.json(
        { error: "titleId, seasonNumber e episodes são obrigatórios." },
        { status: 400 },
      );
    }

    // Verificar se título existe
    const title = await prisma.title.findUnique({
      where: { id: titleId },
    });

    if (!title) {
      return NextResponse.json({ error: "Título não encontrado." }, { status: 404 });
    }

    // Criar episódios em batch
    const created = await prisma.episode.createMany({
      data: episodes.map((ep) => ({
        titleId,
        seasonNumber,
        episodeNumber: ep.episodeNumber,
        name: ep.name,
        overview: ep.overview || null,
        hlsPath: `episodes/${title.slug}/s${seasonNumber.toString().padStart(2, "0")}e${ep.episodeNumber.toString().padStart(2, "0")}`,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      created: created.count,
      message: `${created.count} episódio(s) criado(s) com sucesso.`,
    });
  } catch (error) {
    console.error("POST /api/admin/episodes/create-batch error", error);
    return NextResponse.json(
      { error: "Erro ao criar episódios em lote." },
      { status: 500 },
    );
  }
}
