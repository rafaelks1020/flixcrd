import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailjet';

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

    try {
      if (user.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
        const planName = subscription.plan === 'DUO' ? 'Plano Duo' : 'Plano Basic';
        const endDateStr = subscription.currentPeriodEnd
          ? subscription.currentPeriodEnd.toLocaleDateString('pt-BR')
          : endDate.toLocaleDateString('pt-BR');

        await sendMail({
          to: user.email,
          subject: `Assinatura ativada - ${planName}`,
          fromEmail: 'financeiro@pflix.com.br',
          fromName: 'Financeiro FlixCRD',
          meta: {
            reason: 'admin-subscription-activated',
            userId: user.id,
            subscriptionId: subscription.id,
            extra: {
              days,
            },
          },
          context: {
            userId: user.id,
            subscriptionId: subscription.id,
            days,
            periodEnd: subscription.currentPeriodEnd,
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Assinatura ativada</h2>
              <p>Olá, ${user.name || user.email}!</p>
              <p>Sua assinatura <strong>${planName}</strong> foi ativada manualmente por ${days} dia(s).</p>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Plano:</strong> ${planName}</p>
                <p><strong>Válida até:</strong> ${endDateStr}</p>
              </div>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}" 
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  🎬 Começar a assistir
                </a>
              </p>
            </div>
          `,
          text: `
Assinatura ativada - ${planName}

Olá, ${user.name || user.email}!

Sua assinatura ${planName} foi ativada manualmente por ${days} dia(s).
Válida até: ${endDateStr}

Acesse: ${appUrl}
          `,
        });
      }
    } catch (emailError) {
      console.error('[/api/admin/subscriptions/activate] Erro ao enviar email de ativação:', emailError);
    }

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
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
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

    if (subscription?.User?.email) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
        await sendMail({
          to: subscription.User.email,
          subject: 'Assinatura cancelada - FlixCRD',
          fromEmail: 'financeiro@pflix.com.br',
          fromName: 'Financeiro FlixCRD',
          meta: {
            reason: 'admin-subscription-canceled',
            userId: subscription.userId,
            subscriptionId: subscription.id,
          },
          context: {
            userId: subscription.userId,
            subscriptionId: subscription.id,
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Assinatura cancelada</h2>
              <p>Olá, ${subscription.User.name || subscription.User.email}.</p>
              <p>Sua assinatura no <strong>FlixCRD</strong> foi cancelada por um administrador.</p>
              <p>Você pode reativar sua assinatura a qualquer momento acessando a plataforma.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/subscribe" 
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Renovar assinatura
                </a>
              </p>
            </div>
          `,
          text: `
Assinatura cancelada - FlixCRD

Olá, ${subscription.User.name || subscription.User.email}.

Sua assinatura no FlixCRD foi cancelada por um administrador.
Você pode reativar sua assinatura a qualquer momento acessando a plataforma.

Acesse: ${appUrl}/subscribe
          `,
        });
      } catch (emailError) {
        console.error('[/api/admin/subscriptions/activate] Erro ao enviar email de cancelamento:', emailError);
      }
    }

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
