import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { corsHeaders, corsOptionsResponse } from '@/lib/cors';
import { prisma } from '@/lib/prisma';
import {
  filterTokensByPreference,
  NotificationCategory,
  sendPushToUsers,
  sendPushToTokens,
} from '@/lib/push';

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
      category,
    } = body as {
      title?: string;
      message?: string;
      data?: Record<string, unknown>;
      targetType?: 'all' | 'user';
      targetUserIds?: string[];
      channelId?: string;
      category?: NotificationCategory;
    };

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Título e mensagem são obrigatórios' },
        { status: 400, headers: corsHeaders }
      );
    }

    let result;
    if (targetType === 'user' && targetUserIds.length > 0) {
      result = await sendPushToUsers(targetUserIds, {
        title,
        message,
        data,
        channelId,
        category,
      });
    } else {
      const tokens = await prisma.pushToken.findMany({
        where: { isActive: true },
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

      if (!filteredTokens.length) {
        return NextResponse.json(
          { success: true, sent: 0, failed: 0, total: 0, message: 'Nenhum dispositivo encontrado' },
          { headers: corsHeaders },
        );
      }

      result = await sendPushToTokens(filteredTokens, {
        title,
        message,
        data,
        channelId,
        category,
      });
    }

    return NextResponse.json(
      { 
        success: true, 
        sent: result.sent, 
        failed: result.failed,
        total: result.total,
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
