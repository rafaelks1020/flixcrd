import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const requests = await prisma.request.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        imdbId: true,
        imdbJson: true,
        status: true,
        workflowState: true,
        followersCount: true,
        priorityScore: true,
        desiredLanguages: true,
        desiredQuality: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("GET /api/solicitacoes error", error);
    return NextResponse.json(
      { error: "Erro ao carregar solicitações." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      imdbId,
      imdbJson,
      type,
      desiredLanguages,
      desiredQuality,
      note,
    } = body ?? {};

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Título é obrigatório." },
        { status: 400 },
      );
    }

    const activeStatuses = [
      "PENDING",
      "UNDER_REVIEW",
      "IN_PRODUCTION",
      "UPLOADING",
    ] as any;

    const activeCount = await prisma.request.count({
      where: {
        userId: user.id,
        status: { in: activeStatuses },
      },
    });

    if (activeCount >= 5) {
      return NextResponse.json(
        { error: "Limite de solicitações ativas atingido." },
        { status: 400 },
      );
    }

    // Rate-limit simples: máximo 1 nova solicitação a cada 30 segundos por usuário
    const THROTTLE_WINDOW_MS = 30_000;
    const thirtySecondsAgo = new Date(Date.now() - THROTTLE_WINDOW_MS);

    const recentCount = await prisma.request.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: thirtySecondsAgo,
        },
      },
    });

    if (recentCount > 0) {
      return NextResponse.json(
        { error: "Aguarde alguns segundos antes de criar outra solicitação." },
        { status: 429 },
      );
    }

    if (imdbId && typeof imdbId === "string") {
      const existing = await prisma.request.findFirst({
        where: { imdbId },
        orderBy: { createdAt: "asc" },
      });

      if (existing) {
        return NextResponse.json(
          {
            error: "Já existe uma solicitação para esse conteúdo.",
            requestId: existing.id,
          },
          { status: 409 },
        );
      }
    }

    const requestType = ["MOVIE", "SERIES", "ANIME", "DORAMA", "OTHER"].includes(
      type,
    )
      ? type
      : "MOVIE";

    const desiredLanguagesValue = Array.isArray(desiredLanguages)
      ? JSON.stringify(desiredLanguages)
      : typeof desiredLanguages === "string"
        ? desiredLanguages
        : null;

    const desiredQualityValue =
      desiredQuality !== undefined && desiredQuality !== null
        ? String(desiredQuality)
        : null;

    const createdRequest = await prisma.request.create({
      data: {
        userId: user.id,
        imdbId: imdbId ? String(imdbId) : null,
        title: title.trim(),
        type: requestType as any,
        desiredLanguages: desiredLanguagesValue,
        desiredQuality: desiredQualityValue,
        note: note ? String(note) : null,
        ...(imdbJson !== undefined && { imdbJson }),
      },
    });

    await prisma.requestFollower.create({
      data: {
        requestId: createdRequest.id,
        userId: user.id,
      },
    });

    await prisma.requestHistory.create({
      data: {
        requestId: createdRequest.id,
        action: "CREATED" as any,
        message: null,
        adminId: null,
      },
    });

    const updatedRequest = await prisma.request.update({
      where: { id: createdRequest.id },
      data: { followersCount: 1 },
    });

    return NextResponse.json(updatedRequest, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/solicitacoes error", error);

    const message = error?.message ?? "Erro desconhecido";
    const code = error?.code ?? undefined;

    return NextResponse.json(
      {
        error: "Erro ao criar solicitação.",
        detail: message,
        code,
      },
      { status: 500 },
    );
  }
}
