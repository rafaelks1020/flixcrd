import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Ativa manualmente uma assinatura para um usuário (apenas admin)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, days = 30 } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);

    // Criar ou atualizar assinatura
    const subscription = await prisma.subscription.upsert({
      where: { userId },
      update: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: endDate,
      },
      create: {
        userId,
        status: 'ACTIVE',
        plan: 'BASIC',
        price: 10.0,
        currentPeriodStart: now,
        currentPeriodEnd: endDate,
      },
    });

    return NextResponse.json({
      success: true,
      subscription,
      message: `Assinatura ativada por ${days} dias`,
    });

  } catch (error: any) {
    console.error('Erro ao ativar assinatura:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao ativar assinatura' },
      { status: 500 }
    );
  }
}

/**
 * Cancela uma assinatura (apenas admin)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 });
    }

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'CANCELED',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Assinatura cancelada',
    });

  } catch (error: any) {
    console.error('Erro ao cancelar assinatura:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao cancelar assinatura' },
      { status: 500 }
    );
  }
}
