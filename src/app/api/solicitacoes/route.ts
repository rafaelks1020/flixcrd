import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";
import { sendMail } from "@/lib/mailjet";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const scope = request.nextUrl.searchParams.get("scope");
    const where =
      scope === "all"
        ? {
            OR: [
              { userId: user.id },
              {
                RequestFollower: {
                  some: {
                    userId: user.id,
                  },
                },
              },
            ],
          }
        : { userId: user.id };

    const requests = await prisma.request.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
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

    // Enviar email para o admin notificando sobre a nova solicitação
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      try {
        const typeLabels: Record<string, string> = {
          MOVIE: "Filme",
          SERIES: "Série",
          ANIME: "Anime",
          DORAMA: "Dorama",
          OTHER: "Outro",
        };
        const requestTypeLabel = typeLabels[requestType] || "Desconhecido";

        await sendMail({
          to: adminEmail,
          subject: `🎬 Nova solicitação: ${title}`,
          fromEmail: "contato@pflix.com.br",
          fromName: "FlixCRD",
          meta: {
            reason: "request-created",
            userId: user.id,
            requestId: createdRequest.id,
          },
          context: {
            type: requestTypeLabel,
            imdbId,
            desiredLanguages: desiredLanguagesValue,
            desiredQuality: desiredQualityValue,
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">🎬 Nova Solicitação de Conteúdo</h2>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Título:</strong> ${title}</p>
                <p><strong>Tipo:</strong> ${requestTypeLabel}</p>
                <p><strong>Usuário:</strong> ${user.name || user.email}</p>
                ${imdbId ? `<p><strong>IMDB ID:</strong> <a href="https://www.imdb.com/title/${imdbId}">${imdbId}</a></p>` : ""}
                ${desiredLanguagesValue ? `<p><strong>Idiomas desejados:</strong> ${desiredLanguagesValue}</p>` : ""}
                ${desiredQualityValue ? `<p><strong>Qualidade desejada:</strong> ${desiredQualityValue}</p>` : ""}
                ${note ? `<p><strong>Observações:</strong> ${note}</p>` : ""}
              </div>
              <p style="text-align: center;">
                <a href="${new URL(request.url).origin}/admin/solicitacoes" 
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Ver no Admin
                </a>
              </p>
            </div>
          `,
          text: `
Nova Solicitação de Conteúdo

Título: ${title}
Tipo: ${requestTypeLabel}
Usuário: ${user.name || user.email}
${imdbId ? `IMDB ID: https://www.imdb.com/title/${imdbId}` : ""}
${desiredLanguagesValue ? `Idiomas desejados: ${desiredLanguagesValue}` : ""}
${desiredQualityValue ? `Qualidade desejada: ${desiredQualityValue}` : ""}
${note ? `Observações: ${note}` : ""}

Acesse: ${new URL(request.url).origin}/admin/solicitacoes
          `,
        });

        console.log(
          `[Solicitacoes] Email enviado para admin sobre solicitação #${createdRequest.id}`,
        );
      } catch (emailError) {
        // Não bloqueia a criação da solicitação se o email falhar
        console.error(
          "[Solicitacoes] Erro ao enviar email para admin:",
          emailError,
        );
      }
    }
    try {
      if (user.email) {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

        await sendMail({
          to: user.email,
          subject: `Recebemos sua solicitação: ${title}`,
          fromEmail: "contato@pflix.com.br",
          fromName: "FlixCRD",
          meta: {
            reason: "request-confirmation",
            userId: user.id,
            requestId: createdRequest.id,
          },
          context: {
            requestId: createdRequest.id,
            title,
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Recebemos sua solicitação</h2>
              <p>Olá, ${user.name || user.email}!</p>
              <p>Sua solicitação de conteúdo <strong>${title}</strong> foi registrada com sucesso.</p>
              <p>Você será avisado quando houver atualizações no status dessa solicitação.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/solicitacoes" 
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Ver minhas solicitações
                </a>
              </p>
            </div>
          `,
          text: `
Recebemos sua solicitação

Olá, ${user.name || user.email}!

Sua solicitação de conteúdo "${title}" foi registrada com sucesso.
Você será avisado quando houver atualizações no status dessa solicitação.

Acesse: ${appUrl}/solicitacoes
          `,
        });
      }
    } catch (emailError) {
      console.error(
        "[Solicitacoes] Erro ao enviar email de confirmação:",
        emailError,
      );
    }

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
