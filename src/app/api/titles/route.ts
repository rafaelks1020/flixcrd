import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;

  const titles = await prisma.title.findMany({
    where: q
      ? {
          name: {
            contains: q,
            mode: "insensitive",
          },
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(titles);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      tmdbId,
      type,
      slug,
      name,
      originalName,
      overview,
      releaseDate,
      posterUrl,
      backdropUrl,
      hlsPath,
    } = body ?? {};

    if (!name || !type || !slug) {
      return NextResponse.json(
        { error: "Campos obrigatórios: name, type, slug." },
        { status: 400 },
      );
    }

    const title = await prisma.title.create({
      data: {
        tmdbId: tmdbId ?? null,
        type,
        slug,
        name,
        originalName: originalName ?? null,
        overview: overview ?? null,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        posterUrl: posterUrl ?? null,
        backdropUrl: backdropUrl ?? null,
        hlsPath: hlsPath ?? null,
      },
    });

    return NextResponse.json(title, { status: 201 });
  } catch (error) {
    console.error("POST /api/titles error", error);
    return NextResponse.json(
      { error: "Erro ao criar título." },
      { status: 500 },
    );
  }
}
