import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

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
    } = body;

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
      select: { token: true },
    });

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: "Nenhum dispositivo encontrado",
      });
    }

    // Preparar mensagens para o Expo Push
    const messages: ExpoPushMessage[] = tokens.map((t: { token: string }) => ({
      to: t.token,
      title,
      body: message,
      data: data || {},
      sound: "default",
      channelId,
    }));

    // Enviar em lotes de 100 (limite do Expo)
    const chunks: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    let successCount = 0;
    let errorCount = 0;

    for (const chunk of chunks) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data) {
            for (let i = 0; i < result.data.length; i++) {
              const item = result.data[i];
              if (item.status === "ok") {
                successCount++;
              } else {
                errorCount++;
                // Se o token for inválido, desativar
                if (item.details?.error === "DeviceNotRegistered") {
                  const failedToken = chunk[i]?.to;
                  if (failedToken) {
                    await prisma.pushToken.updateMany({
                      where: { token: failedToken },
                      data: { isActive: false },
                    });
                  }
                }
              }
            }
          }
        } else {
          errorCount += chunk.length;
        }
      } catch (error) {
        console.error("Error sending push chunk:", error);
        errorCount += chunk.length;
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: errorCount,
      total: tokens.length,
    });
  } catch (error) {
    console.error("Error sending notifications:", error);
    return NextResponse.json(
      { error: "Erro ao enviar notificações" },
      { status: 500 }
    );
  }
}
