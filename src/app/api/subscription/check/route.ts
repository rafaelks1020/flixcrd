import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-mobile';
import { prisma } from '@/lib/prisma';

/**
 * Verifica se o usuário tem assinatura ativa
 * Usado pelo player antes de carregar o vídeo
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json({ 
        canWatch: false, 
        reason: 'NOT_AUTHENTICATED' 
      });
    }

    const userId = authUser.id;
    const userRole = authUser.role;

    // Admin sempre pode assistir
    if (userRole === 'ADMIN') {
      return NextResponse.json({ 
        canWatch: true, 
        reason: 'ADMIN',
        isAdmin: true,
      });
    }

    // Buscar assinatura
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return NextResponse.json({ 
        canWatch: false, 
        reason: 'NO_SUBSCRIPTION',
        message: 'Você precisa de uma assinatura para assistir',
      });
    }

    const now = new Date();
    const isActive = 
      subscription.status === 'ACTIVE' && 
      subscription.currentPeriodEnd && 
      subscription.currentPeriodEnd > now;

    if (!isActive) {
      return NextResponse.json({ 
        canWatch: false, 
        reason: 'SUBSCRIPTION_EXPIRED',
        message: 'Sua assinatura expirou. Renove para continuar assistindo.',
        subscription: {
          status: subscription.status,
          expiredAt: subscription.currentPeriodEnd,
        },
      });
    }

    const daysRemaining = Math.ceil(
      (subscription.currentPeriodEnd!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return NextResponse.json({ 
      canWatch: true, 
      reason: 'ACTIVE_SUBSCRIPTION',
      subscription: {
        status: subscription.status,
        plan: subscription.plan,
        expiresAt: subscription.currentPeriodEnd,
        daysRemaining,
      },
    });

  } catch (error: any) {
    console.error('Erro ao verificar assinatura:', error);
    return NextResponse.json(
      { canWatch: false, reason: 'ERROR', error: error.message },
      { status: 500 }
    );
  }
}
