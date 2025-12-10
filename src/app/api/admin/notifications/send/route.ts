import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  filterTokensByPreference,
  NotificationCategory,
  sendPushToTokens,
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
        user: {
          select: {
            notificationPreference: true,
          },
        },
      },
    });

    const filteredTokens = filterTokensByPreference(tokens, category);

    if (filteredTokens.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: "Nenhum dispositivo encontrado",
      });
    }

    const result = await sendPushToTokens(filteredTokens, {
      title,
      message,
      data,
      channelId,
      category,
    });

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      total: result.total,
    });
  } catch (error) {
    console.error("Error sending notifications:", error);
    return NextResponse.json(
      { error: "Erro ao enviar notificações" },
      { status: 500 }
    );
  }
}
