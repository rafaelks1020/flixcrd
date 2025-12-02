import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const title = await prisma.title.findUnique({
    where: { id: params.id },
  });

  if (!title) {
    return NextResponse.json({ error: "Título não encontrado." }, { status: 404 });
  }

  return NextResponse.json(title);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const data: any = {};

    if (tmdbId !== undefined) data.tmdbId = tmdbId;
    if (type !== undefined) data.type = type;
    if (slug !== undefined) data.slug = slug;
    if (name !== undefined) data.name = name;
    if (originalName !== undefined) data.originalName = originalName;
    if (overview !== undefined) data.overview = overview;
    if (releaseDate !== undefined)
      data.releaseDate = releaseDate ? new Date(releaseDate) : null;
    if (posterUrl !== undefined) data.posterUrl = posterUrl;
    if (backdropUrl !== undefined) data.backdropUrl = backdropUrl;
    if (hlsPath !== undefined) data.hlsPath = hlsPath;

    const updated = await prisma.title.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/titles/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao atualizar título." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await prisma.title.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/titles/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao excluir título." },
      { status: 500 },
    );
  }
}
