import { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { prisma } from "@/lib/prisma";
import { corsOptionsResponse, jsonWithCors } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return jsonWithCors({ error: "Não autenticado." }, { status: 401 });
    }

    const subs = await prisma.webPushSubscription.findMany({
      where: { userId: authUser.id, isActive: true },
      select: {
        id: true,
        endpoint: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    return jsonWithCors({
      supported: true,
      subscribed: subs.length > 0,
      subscriptions: subs,
    });
  } catch (error) {
    console.error("GET /api/webpush/subscription error", error);
    const message = error instanceof Error ? error.message : "Erro ao carregar status de Web Push.";
    if (message.toLowerCase().includes("webpushsubscription") || message.toLowerCase().includes("does not exist")) {
      return jsonWithCors(
        { error: "Web Push ainda não está habilitado no banco. Sincronize o schema do Prisma (db push/migrate) e tente novamente." },
        { status: 503 },
      );
    }
    return jsonWithCors({ error: "Erro ao carregar status de Web Push." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return jsonWithCors({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    const expirationTimeRaw = body?.expirationTime;

    if (!endpoint || !p256dh || !auth) {
      return jsonWithCors(
        { error: "Subscription inválida: endpoint/keys são obrigatórios." },
        { status: 400 },
      );
    }

    const userAgent = request.headers.get("user-agent") ?? null;

    const expirationTime =
      typeof expirationTimeRaw === "number" && Number.isFinite(expirationTimeRaw)
        ? new Date(expirationTimeRaw)
        : null;

    await prisma.webPushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: authUser.id,
        p256dh,
        auth,
        expirationTime,
        userAgent,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: authUser.id,
        endpoint,
        p256dh,
        auth,
        expirationTime,
        userAgent,
        isActive: true,
      },
    });

    return jsonWithCors({ success: true });
  } catch (error) {
    console.error("POST /api/webpush/subscription error", error);
    const message = error instanceof Error ? error.message : "Erro ao salvar Web Push subscription.";
    if (message.toLowerCase().includes("webpushsubscription") || message.toLowerCase().includes("does not exist")) {
      return jsonWithCors(
        { error: "Web Push ainda não está habilitado no banco. Sincronize o schema do Prisma (db push/migrate) e tente novamente." },
        { status: 503 },
      );
    }
    return jsonWithCors({ error: "Erro ao salvar Web Push subscription." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return jsonWithCors({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const endpoint = body?.endpoint;

    if (endpoint) {
      await prisma.webPushSubscription.updateMany({
        where: { userId: authUser.id, endpoint },
        data: { isActive: false, updatedAt: new Date() },
      });
    } else {
      await prisma.webPushSubscription.updateMany({
        where: { userId: authUser.id },
        data: { isActive: false, updatedAt: new Date() },
      });
    }

    return jsonWithCors({ success: true });
  } catch (error) {
    console.error("DELETE /api/webpush/subscription error", error);
    return jsonWithCors({ error: "Erro ao remover Web Push subscription." }, { status: 500 });
  }
}
