import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculatePeriodEnd } from '@/lib/asaas';
import { sendMail } from '@/lib/mailjet';

/**
 * Webhook do Asaas para receber notificações de pagamento
 * URL: https://pflix.com.br/api/webhook
 * 
 * Eventos tratados:
 * - PAYMENT_CONFIRMED: Pagamento confirmado (saldo ainda não disponível)
 * - PAYMENT_RECEIVED: Pagamento recebido (saldo disponível)
 * - PAYMENT_OVERDUE: Pagamento vencido
 * - PAYMENT_DELETED: Pagamento removido
 * - PAYMENT_REFUNDED: Pagamento estornado
 * - PAYMENT_CREATED: Nova cobrança criada
 */

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    customer: string;
    value: number;
    netValue: number;
    status: string;
    billingType: string;
    dueDate: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    externalReference?: string;
    subscription?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    invoiceNumber?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: AsaasWebhookPayload = await request.json();
    
    console.log('[Webhook Asaas]', JSON.stringify(payload, null, 2));

    const { event, payment } = payload;

    if (!payment) {
      console.log('[Webhook] Evento sem dados de pagamento:', event);
      return NextResponse.json({ received: true, message: 'No payment data' });
    }

    // Buscar pagamento no banco pelo ID do Asaas
    let dbPayment = await prisma.payment.findUnique({
      where: { asaasPaymentId: payment.id },
      include: { 
        Subscription: {
          include: {
            User: true,
          },
        },
      },
    });

    // Se não encontrou, tentar pela referência externa (userId)
    if (!dbPayment && payment.externalReference) {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: payment.externalReference },
      });
      
      if (subscription) {
        // Criar registro do pagamento
        dbPayment = await prisma.payment.create({
          data: {
            subscriptionId: subscription.id,
            asaasPaymentId: payment.id,
            status: payment.status,
            value: payment.value,
            billingType: payment.billingType,
            dueDate: new Date(payment.dueDate),
            paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : null,
            invoiceUrl: payment.invoiceUrl || payment.bankSlipUrl,
          },
          include: { Subscription: { include: { User: true } } },
        });
        console.log('[Webhook] Pagamento criado a partir do webhook:', dbPayment.id);
      }
    }

    if (!dbPayment) {
      console.log('[Webhook] Pagamento não encontrado:', payment.id);
      return NextResponse.json({ received: true, message: 'Payment not found in DB' });
    }

    // Atualizar status do pagamento
    await prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: payment.status,
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : 
                     payment.clientPaymentDate ? new Date(payment.clientPaymentDate) : null,
        invoiceUrl: payment.invoiceUrl || payment.bankSlipUrl || dbPayment.invoiceUrl,
      },
    });

    // Processar eventos específicos
    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        // Pagamento confirmado - ativar assinatura por 30 dias
        const now = new Date();
        const periodEnd = calculatePeriodEnd(now);
        await prisma.subscription.update({
          where: { id: dbPayment.subscriptionId },
          data: {
            status: 'ACTIVE',
            asaasPaymentId: payment.id,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
        console.log(`[Webhook] Assinatura ${dbPayment.subscriptionId} ATIVADA por 30 dias`);

        // Enviar email de confirmação
        if (dbPayment.Subscription?.User) {
          const user = dbPayment.Subscription.User;
          const planName = dbPayment.Subscription.plan === 'DUO' ? 'Plano Duo' : 'Plano Basic';
          
          try {
            await sendMail({
              to: user.email,
              subject: `✅ Pagamento Confirmado - ${planName}`,
              fromEmail: "financeiro@pflix.com.br",
              fromName: "Financeiro FlixCRD",
              meta: {
                reason: "payment-webhook",
                userId: dbPayment.Subscription.userId,
                subscriptionId: dbPayment.subscriptionId,
                paymentId: payment.id,
                event,
              },
              context: {
                value: payment.value,
                dueDate: payment.dueDate,
                status: payment.status,
              },
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #00cc00;">✅ Pagamento Confirmado!</h2>
                  <p>Olá, ${user.name || 'usuário'}!</p>
                  <p>Seu pagamento foi confirmado e sua assinatura está ativa! 🎉</p>
                  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Plano:</strong> ${planName}</p>
                    <p><strong>Valor pago:</strong> R$ ${payment.value.toFixed(2).replace('.', ',')}</p>
                    <p><strong>Válido até:</strong> ${periodEnd.toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p style="text-align: center;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://pflix.com.br'}" 
                       style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                      🎬 Começar a assistir
                    </a>
                  </p>
                  <p style="color: #666; font-size: 14px;">
                    Aproveite todo o conteúdo disponível na plataforma!
                  </p>
                </div>
              `,
              text: `
✅ Pagamento Confirmado!

Olá, ${user.name || 'usuário'}!

Seu pagamento foi confirmado e sua assinatura está ativa! 🎉

Plano: ${planName}
Valor pago: R$ ${payment.value.toFixed(2).replace('.', ',')}
Válido até: ${periodEnd.toLocaleDateString('pt-BR')}

Acesse: ${process.env.NEXT_PUBLIC_APP_URL || 'https://pflix.com.br'}

Aproveite todo o conteúdo disponível na plataforma!
              `,
            });
            console.log(`[Webhook] Email de confirmação enviado para ${user.email}`);
          } catch (emailError) {
            console.error('[Webhook] Erro ao enviar email de confirmação:', emailError);
          }
        }
        break;

      case 'PAYMENT_OVERDUE':
        await prisma.subscription.update({
          where: { id: dbPayment.subscriptionId },
          data: { status: 'OVERDUE' },
        });
        console.log(`[Webhook] Assinatura ${dbPayment.subscriptionId} marcada como VENCIDA`);

        // Enviar email de pagamento vencido
        if (dbPayment.Subscription?.User) {
          const user = dbPayment.Subscription.User;
          const planName = dbPayment.Subscription.plan === 'DUO' ? 'Plano Duo' : 'Plano Basic';
          
          try {
            await sendMail({
              to: user.email,
              subject: `⚠️ Pagamento Vencido - ${planName}`,
              fromEmail: "financeiro@pflix.com.br",
              fromName: "Financeiro FlixCRD",
              meta: {
                reason: "payment-webhook",
                userId: dbPayment.Subscription.userId,
                subscriptionId: dbPayment.subscriptionId,
                paymentId: payment.id,
                event,
              },
              context: {
                value: payment.value,
                dueDate: payment.dueDate,
                status: payment.status,
              },
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #ff9900;">⚠️ Pagamento Vencido</h2>
                  <p>Olá, ${user.name || 'usuário'}!</p>
                  <p>O pagamento da sua assinatura <strong>${planName}</strong> está vencido.</p>
                  <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9900;">
                    <p><strong>Valor:</strong> R$ ${payment.value.toFixed(2).replace('.', ',')}</p>
                    <p><strong>Vencimento:</strong> ${new Date(payment.dueDate).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p>Por favor, regularize seu pagamento para continuar aproveitando a plataforma.</p>
                  <p style="text-align: center;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://pflix.com.br'}/subscribe" 
                       style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                      Renovar Assinatura
                    </a>
                  </p>
                </div>
              `,
              text: `
⚠️ Pagamento Vencido

Olá, ${user.name || 'usuário'}!

O pagamento da sua assinatura ${planName} está vencido.

Valor: R$ ${payment.value.toFixed(2).replace('.', ',')}
Vencimento: ${new Date(payment.dueDate).toLocaleDateString('pt-BR')}

Por favor, regularize seu pagamento para continuar aproveitando a plataforma.

Acesse: ${process.env.NEXT_PUBLIC_APP_URL || 'https://pflix.com.br'}/subscribe
              `,
            });
            console.log(`[Webhook] Email de vencimento enviado para ${user.email}`);
          } catch (emailError) {
            console.error('[Webhook] Erro ao enviar email de vencimento:', emailError);
          }
        }
        break;

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_IN_PROGRESS':
        await prisma.subscription.update({
          where: { id: dbPayment.subscriptionId },
          data: { status: 'CANCELED' },
        });
        console.log(`[Webhook] Assinatura ${dbPayment.subscriptionId} CANCELADA`);
        break;

      case 'PAYMENT_CREATED':
      case 'PAYMENT_UPDATED':
        // Apenas log, não precisa fazer nada
        console.log(`[Webhook] Evento ${event} para pagamento ${payment.id}`);
        break;

      default:
        console.log(`[Webhook] Evento não tratado: ${event}`);
    }

    return NextResponse.json({ 
      received: true, 
      event,
      paymentId: payment.id,
      status: payment.status,
    });

  } catch (error: any) {
    console.error('[Webhook] Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro no webhook' },
      { status: 500 }
    );
  }
}

// GET para verificar se o webhook está funcionando
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Webhook endpoint ativo - Pflix',
    timestamp: new Date().toISOString(),
  });
}
