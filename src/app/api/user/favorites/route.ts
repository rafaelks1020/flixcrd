import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUser() {
  const session: any = await getServerSession(authOptions as any);

  if (!session || !session.user || !session.user.id) {
    return { userId: null };
  }

  return { userId: session.user.id as string };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireUser();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // Pegar profileId do header ou query
    const profileId = request.headers.get("x-profile-id") || request.nextUrl.searchParams.get("profileId");
    
    if (!profileId) {
      return NextResponse.json({ error: "profileId é obrigatório." }, { status: 400 });
    }

    // Verificar se perfil pertence ao usuário
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    const favorites = await prisma.userFavorite.findMany({
      where: { profileId },
      include: {
        title: {
          select: {
            id: true,
            name: true,
            slug: true,
            posterUrl: true,
            backdropUrl: true,
            voteAverage: true,
            releaseDate: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20, // Reduzido de 100 para 20 (suficiente para a home)
    });

    const titles = favorites.map((fav: any) => ({
      id: fav.title.id,
      name: fav.title.name,
      slug: fav.title.slug,
      posterUrl: fav.title.posterUrl,
      backdropUrl: fav.title.backdropUrl,
      voteAverage: fav.title.voteAverage,
      releaseDate: fav.title.releaseDate
        ? fav.title.releaseDate.toISOString()
        : null,
      type: fav.title.type,
    }));

    return NextResponse.json(titles);
  } catch (error) {
    console.error("GET /api/user/favorites error", error);
    return NextResponse.json(
      { error: "Erro ao listar favoritos." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireUser();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const titleId = body?.titleId as string | undefined;
    const profileId = body?.profileId as string | undefined;

    if (!titleId) {
      return NextResponse.json(
        { error: "titleId é obrigatório." },
        { status: 400 },
      );
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId é obrigatório." },
        { status: 400 },
      );
    }

    // Verificar se perfil pertence ao usuário
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    const exists = await prisma.title.findUnique({ where: { id: titleId } });
    if (!exists) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    await prisma.userFavorite.upsert({
      where: {
        profileId_titleId: {
          profileId,
          titleId,
        },
      },
      update: {},
      create: {
        profileId,
        titleId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/user/favorites error", error);
    return NextResponse.json(
      { error: "Erro ao adicionar à Minha lista." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireUser();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const titleId = body?.titleId as string | undefined;
    const profileId = body?.profileId as string | undefined;

    if (!titleId) {
      return NextResponse.json(
        { error: "titleId é obrigatório." },
        { status: 400 },
      );
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId é obrigatório." },
        { status: 400 },
      );
    }

    // Verificar se perfil pertence ao usuário
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    await prisma.userFavorite.deleteMany({
      where: {
        profileId,
        titleId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/user/favorites error", error);
    return NextResponse.json(
      { error: "Erro ao remover de Minha lista." },
      { status: 500 },
    );
  }
}
