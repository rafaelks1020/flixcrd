import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { corsHeaders, corsOptionsResponse } from '@/lib/cors';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export async function OPTIONS() {
  return corsOptionsResponse();
}

// POST - Enviar notificação (apenas admin)
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyMobileToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Verificar se é admin
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Apenas administradores podem enviar notificações' },
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { 
      title, 
      message, 
      data, 
      targetType = 'all', // 'all', 'user', 'users'
      targetUserIds = [],
      channelId = 'default',
    } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Título e mensagem são obrigatórios' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Buscar tokens ativos
    let tokens: { token: string }[] = [];
    
    if (targetType === 'all') {
      tokens = await prisma.pushToken.findMany({
        where: { isActive: true },
        select: { token: true },
      });
    } else if (targetType === 'user' && targetUserIds.length > 0) {
      tokens = await prisma.pushToken.findMany({
        where: { 
          isActive: true,
          userId: { in: targetUserIds },
        },
        select: { token: true },
      });
    }

    if (tokens.length === 0) {
      return NextResponse.json(
        { success: true, sent: 0, message: 'Nenhum dispositivo encontrado' },
        { headers: corsHeaders }
      );
    }

    // Preparar mensagens para o Expo Push
    const messages: ExpoPushMessage[] = tokens.map(t => ({
      to: t.token,
      title,
      body: message,
      data: data || {},
      sound: 'default',
      channelId,
    }));

    // Enviar em lotes de 100 (limite do Expo)
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    let successCount = 0;
    let errorCount = 0;

    for (const chunk of chunks) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        if (response.ok) {
          const result = await response.json();
          // Contar sucessos e erros
          if (result.data) {
            for (const item of result.data) {
              if (item.status === 'ok') {
                successCount++;
              } else {
                errorCount++;
                // Se o token for inválido, desativar
                if (item.details?.error === 'DeviceNotRegistered') {
                  const failedToken = chunk.find((_, idx) => result.data[idx] === item)?.to;
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
        console.error('Error sending push chunk:', error);
        errorCount += chunk.length;
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        sent: successCount, 
        failed: errorCount,
        total: tokens.length,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error sending notifications:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar notificações' },
      { status: 500, headers: corsHeaders }
    );
  }
}
