import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  filterTokensByPreference,
  NotificationCategory,
  sendPushToTokens,
  sendWebPushToAll,
} from "@/lib/push";

// POST - Envia notificação para dispositivos
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      message,
      data,
      targetType = "active", // 'all' ou 'active'
      channelId = "default",
      category,
    } = body as {
      title?: string;
      message?: string;
      data?: Record<string, unknown>;
      targetType?: "all" | "active";
      channelId?: string;
      category?: NotificationCategory;
    };

    if (!title || !message) {
      return NextResponse.json(
        { error: "Título e mensagem são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar tokens
    const whereClause = targetType === "active" ? { isActive: true } : {};
    const tokens = await prisma.pushToken.findMany({
      where: whereClause,
      select: {
        token: true,
        User: {
          select: {
            NotificationPreference: true,
          },
        },
      },
    });

    const filteredTokens = filterTokensByPreference(tokens, category);

    const expoResult = filteredTokens.length
      ? await sendPushToTokens(filteredTokens, {
          title,
          message,
          data,
          channelId,
          category,
        })
      : { total: 0, sent: 0, failed: 0 };

    const webResult = await sendWebPushToAll({
      title,
      message,
      data,
      channelId,
      category,
    });

    if (expoResult.total + webResult.total === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: "Nenhum dispositivo encontrado",
        sentExpo: 0,
        failedExpo: 0,
        totalExpo: 0,
        sentWeb: 0,
        failedWeb: 0,
        totalWeb: 0,
      });
    }

    return NextResponse.json({
      success: true,
      sent: expoResult.sent + webResult.sent,
      failed: expoResult.failed + webResult.failed,
      total: expoResult.total + webResult.total,
      sentExpo: expoResult.sent,
      failedExpo: expoResult.failed,
      totalExpo: expoResult.total,
      sentWeb: webResult.sent,
      failedWeb: webResult.failed,
      totalWeb: webResult.total,
    });
  } catch (error) {
    console.error("Error sending notifications:", error);
    return NextResponse.json(
      { error: "Erro ao enviar notificações" },
      { status: 500 }
    );
  }
}
