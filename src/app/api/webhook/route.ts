import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculatePeriodEnd } from '@/lib/asaas';

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
      include: { subscription: true },
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
          include: { subscription: true },
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
        await prisma.subscription.update({
          where: { id: dbPayment.subscriptionId },
          data: {
            status: 'ACTIVE',
            asaasPaymentId: payment.id,
            currentPeriodStart: now,
            currentPeriodEnd: calculatePeriodEnd(now),
          },
        });
        console.log(`[Webhook] Assinatura ${dbPayment.subscriptionId} ATIVADA por 30 dias`);
        break;

      case 'PAYMENT_OVERDUE':
        await prisma.subscription.update({
          where: { id: dbPayment.subscriptionId },
          data: { status: 'OVERDUE' },
        });
        console.log(`[Webhook] Assinatura ${dbPayment.subscriptionId} marcada como VENCIDA`);
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
