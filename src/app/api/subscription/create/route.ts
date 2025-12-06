import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getOrCreateCustomer,
  createPayment,
  getPixQrCode,
  getNextDueDate,
  calculatePeriodEnd,
  calculateFinalPrice,
  PLAN_CONFIG,
} from '@/lib/asaas';

interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CreditCardHolderInfo {
  name: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { 
      billingType = 'PIX', 
      cpfCnpj,
      creditCard,
      creditCardHolderInfo,
      plan = 'BASIC',
    } = body as {
      billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
      cpfCnpj?: string;
      creditCard?: CreditCardData;
      creditCardHolderInfo?: CreditCardHolderInfo;
      plan?: 'BASIC' | 'DUO';
    };

    // Validar dados do cartão se for cartão de crédito
    if (billingType === 'CREDIT_CARD') {
      if (!creditCard || !creditCardHolderInfo) {
        return NextResponse.json({ 
          error: 'Dados do cartão são obrigatórios' 
        }, { status: 400 });
      }
      if (!creditCardHolderInfo.cpfCnpj) {
        return NextResponse.json({ 
          error: 'CPF/CNPJ é obrigatório para pagamento com cartão' 
        }, { status: 400 });
      }
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar se já tem assinatura ativa
    if (user.subscription?.status === 'ACTIVE') {
      const now = new Date();
      if (user.subscription.currentPeriodEnd && user.subscription.currentPeriodEnd > now) {
        return NextResponse.json({ 
          error: 'Você já possui uma assinatura ativa',
          subscription: user.subscription,
        }, { status: 400 });
      }
    }

    // Calcular preço com taxas
    const planKey = plan === 'DUO' ? 'DUO' : 'BASIC';
    const pricing = calculateFinalPrice(billingType, planKey);

    // Criar ou buscar cliente no Asaas
    const customer = await getOrCreateCustomer({
      name: user.name || user.email.split('@')[0],
      email: user.email,
      cpfCnpj: cpfCnpj || creditCardHolderInfo?.cpfCnpj,
    });

    // Criar cobrança
    const planConfig = PLAN_CONFIG[planKey];
    const dueDate = getNextDueDate();
    
    // Preparar dados do pagamento
    const paymentData: any = {
      customer: customer.id,
      billingType,
      value: pricing.totalPrice,
      dueDate,
      description: `${planConfig.description} (${pricing.feeDescription})`,
      externalReference: userId,
    };

    // Adicionar dados do cartão se for cartão de crédito
    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
      paymentData.creditCard = creditCard;
      paymentData.creditCardHolderInfo = {
        ...creditCardHolderInfo,
        email: user.email,
      };
      // Pegar IP do request
      const forwardedFor = request.headers.get('x-forwarded-for');
      paymentData.remoteIp = forwardedFor?.split(',')[0] || '127.0.0.1';
    }

    const payment = await createPayment(paymentData);

    // Buscar QR Code PIX se for PIX
    let pixData = null;
    if (billingType === 'PIX') {
      pixData = await getPixQrCode(payment.id);
    }

    // Criar ou atualizar subscription no banco
    const now = new Date();
    
    // Se pagamento com cartão foi aprovado, já ativa
    const isCardApproved = billingType === 'CREDIT_CARD' && 
      (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED');
    
    const subscriptionData = {
      status: isCardApproved ? 'ACTIVE' : 'PENDING',
      plan: planKey,
      price: pricing.totalPrice,
      asaasCustomerId: customer.id,
      asaasPaymentId: payment.id,
      currentPeriodStart: now,
      currentPeriodEnd: calculatePeriodEnd(now),
    };

    let subscription;
    if (user.subscription) {
      subscription = await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: subscriptionData,
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          ...subscriptionData,
        },
      });
    }

    // Criar registro de pagamento
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        asaasPaymentId: payment.id,
        status: payment.status,
        value: pricing.totalPrice,
        billingType,
        dueDate: new Date(dueDate),
        paymentDate: isCardApproved ? now : null,
        invoiceUrl: payment.invoiceUrl || payment.bankSlipUrl,
        pixQrCode: pixData?.encodedImage,
        pixCopiaECola: pixData?.payload,
      },
    });

    return NextResponse.json({
      success: true,
      subscription,
      pricing: {
        basePrice: pricing.basePrice,
        fee: pricing.fee,
        totalPrice: pricing.totalPrice,
        feeDescription: pricing.feeDescription,
      },
      payment: {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        dueDate: payment.dueDate,
        billingType,
        invoiceUrl: payment.invoiceUrl || payment.bankSlipUrl,
        pix: pixData ? {
          qrCode: pixData.encodedImage,
          copiaECola: pixData.payload,
          expirationDate: pixData.expirationDate,
        } : null,
        // Se cartão foi aprovado, já está pago
        isPaid: isCardApproved,
      },
    });

  } catch (error: any) {
    console.error('Erro ao criar assinatura:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar assinatura' },
      { status: 500 }
    );
  }
}

// GET - Buscar status da assinatura atual
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({ 
        hasSubscription: false,
        isActive: false,
      });
    }

    const now = new Date();
    const isActive = subscription.status === 'ACTIVE' && 
      subscription.currentPeriodEnd && 
      subscription.currentPeriodEnd > now;

    return NextResponse.json({
      hasSubscription: true,
      isActive,
      subscription: {
        ...subscription,
        daysRemaining: isActive && subscription.currentPeriodEnd
          ? Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      },
    });

  } catch (error: any) {
    console.error('Erro ao buscar assinatura:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar assinatura' },
      { status: 500 }
    );
  }
}
