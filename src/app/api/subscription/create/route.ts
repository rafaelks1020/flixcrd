import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createInterCobrancaBoleto, createInterPixCobImmediate, getInterPixQrCodeByLocId } from '@/lib/inter';
import {
  getOrCreateCustomer,
  createPayment,
  getPixQrCode,
  getNextDueDate,
  calculatePeriodEnd,
  calculateFinalPrice,
  PLAN_CONFIG,
} from '@/lib/asaas';
import { sendMail } from '@/lib/mailjet';

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
      paymentProvider,
    } = body as {
      billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
      cpfCnpj?: string;
      creditCard?: CreditCardData;
      creditCardHolderInfo?: CreditCardHolderInfo;
      plan?: 'BASIC' | 'DUO';
      paymentProvider?: 'ASAAS' | 'INTER';
    };

    const normalizeProvider = (value: unknown): 'ASAAS' | 'INTER' | null => {
      if (typeof value !== 'string') return null;
      const v = value.trim().toUpperCase();
      if (v === 'ASAAS') return 'ASAAS';
      if (v === 'INTER') return 'INTER';
      return null;
    };

    const envProviderRaw =
      (billingType === 'PIX'
        ? process.env.PAYMENTS_PROVIDER_PIX
        : billingType === 'BOLETO'
          ? process.env.PAYMENTS_PROVIDER_BOLETO
          : undefined) ||
      process.env.PAYMENTS_PROVIDER_DEFAULT ||
      process.env.PAYMENTS_PROVIDER ||
      process.env.PAYMENT_PROVIDER;

    const selectedProvider =
      (normalizeProvider(paymentProvider) || normalizeProvider(envProviderRaw)) ||
      'ASAAS';

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
      include: { Subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar se já tem assinatura ativa
    if (user.Subscription?.status === 'ACTIVE') {
      const now = new Date();
      if (user.Subscription.currentPeriodEnd && user.Subscription.currentPeriodEnd > now) {
        return NextResponse.json({ 
          error: 'Você já possui uma assinatura ativa',
          subscription: user.Subscription,
        }, { status: 400 });
      }
    }

    // Calcular preço com taxas
    const planKey = plan === 'DUO' ? 'DUO' : 'BASIC';
    const pricing = calculateFinalPrice(billingType, planKey);

    const planConfig = PLAN_CONFIG[planKey];
    const now = new Date();

    if (billingType === 'CREDIT_CARD' && selectedProvider === 'INTER') {
      return NextResponse.json(
        { error: 'Pagamento com cartão de crédito disponível apenas via Asaas' },
        { status: 400 },
      );
    }

    if (billingType === 'PIX' && selectedProvider === 'INTER') {
      const interPixKey =
        process.env.INTER_PIX_KEY ||
        process.env.INTER_CHAVE_PIX ||
        process.env.INTER_PIX_CHAVE ||
        process.env.PIX_KEY;

      if (!interPixKey) {
        return NextResponse.json(
          { error: 'Chave PIX do Inter não configurada (INTER_PIX_KEY/INTER_CHAVE_PIX)' },
          { status: 500 },
        );
      }

      const expiracaoSegundosRaw = process.env.INTER_PIX_EXPIRATION_SECONDS;
      const expiracaoSegundos = expiracaoSegundosRaw ? Number(expiracaoSegundosRaw) : 3600;
      const expiracaoMs =
        Number.isFinite(expiracaoSegundos) && expiracaoSegundos > 60
          ? Math.floor(expiracaoSegundos) * 1000
          : 3600 * 1000;

      const { txid, locId } = await createInterPixCobImmediate({
        valor: pricing.totalPrice,
        chavePix: interPixKey,
        expiracaoSegundos: Math.floor(expiracaoMs / 1000),
        solicitacaoPagador: `${planConfig.name} - ${planConfig.description}`,
        devedorCpfCnpj: cpfCnpj || user.cpfCnpj || undefined,
      });

      const { copiaECola, qrCodeBase64 } = await getInterPixQrCodeByLocId(locId);

      const expiresAt = new Date(Date.now() + expiracaoMs);
      const expirationDate = expiresAt.toISOString();

      const subscriptionData = {
        status: 'PENDING',
        plan: planKey,
        price: pricing.totalPrice,
        asaasCustomerId: null,
        asaasPaymentId: null,
        currentPeriodStart: now,
        currentPeriodEnd: calculatePeriodEnd(now),
      };

      let subscription;
      if (user.Subscription) {
        subscription = await prisma.subscription.update({
          where: { id: user.Subscription.id },
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

      await prisma.pixPayment.create({
        data: {
          userId: user.id,
          subscriptionId: subscription.id,
          txid,
          valor: pricing.totalPrice,
          status: 'PENDING',
        },
      });

      const dbPayment = await prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          asaasPaymentId: txid,
          status: 'PENDING',
          value: pricing.totalPrice,
          billingType,
          dueDate: expiresAt,
          paymentDate: null,
          invoiceUrl: null,
          pixQrCode: qrCodeBase64,
          pixCopiaECola: copiaECola,
        },
      });

      const origin = new URL(request.url).origin;
      const invoiceProxyUrl = `${origin}/api/payments/${dbPayment.id}/invoice`;

      try {
        const planName = planConfig.name;
        const planPrice = `R$ ${pricing.totalPrice.toFixed(2).replace('.', ',')}`;

        await sendMail({
          to: user.email,
          subject: `Pagamento PIX - ${planName}`,
          fromEmail: 'financeiro@pflix.com.br',
          fromName: 'Financeiro FlixCRD',
          meta: {
            reason: 'payment-created',
            userId: user.id,
            subscriptionId: subscription.id,
            paymentId: txid,
            extra: {
              billingType,
              plan: planName,
              invoiceUrl: invoiceProxyUrl,
            },
          },
          context: {
            value: pricing.totalPrice,
            dueDate: expirationDate,
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">🎬 FlixCRD - Assinatura ${planName}</h2>
              <p>Olá, ${user.name || 'usuário'}!</p>
              <p>Sua assinatura <strong>${planName}</strong> foi criada com sucesso!</p>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Pagamento via PIX</h3>
                <p><strong>Valor:</strong> ${planPrice}</p>
                <p style="font-size: 14px; color: #666;">Escaneie o QR Code abaixo ou use o código Pix Copia e Cola:</p>
                <div style="text-align: center; margin: 20px 0;">
                  <img src="data:image/png;base64,${qrCodeBase64}" alt="QR Code PIX" style="max-width: 200px;" />
                </div>
                <div style="background-color: #fff; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px; font-family: monospace;">
                  ${copiaECola}
                </div>
              </div>
              <p style="color: #666; font-size: 14px;">
                ⏰ Após o pagamento, sua assinatura será ativada automaticamente em alguns minutos.
              </p>
            </div>
          `,
          text: `
FlixCRD - Assinatura ${planName}

Olá, ${user.name || 'usuário'}!

Sua assinatura ${planName} foi criada com sucesso!

Pagamento via PIX
Valor: ${planPrice}

Código Pix Copia e Cola:
${copiaECola}

Após o pagamento, sua assinatura será ativada automaticamente em alguns minutos.
          `,
        });

        console.log(`[Subscription] Email de pagamento enviado para ${user.email} (PIX Inter)`);
      } catch (emailError) {
        console.error('[Subscription] Erro ao enviar email:', emailError);
      }

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
          id: dbPayment.id,
          status: 'PENDING',
          value: pricing.totalPrice,
          dueDate: expirationDate,
          billingType,
          invoiceUrl: `/api/payments/${dbPayment.id}/invoice`,
          pix: {
            qrCode: qrCodeBase64,
            copiaECola,
            expirationDate,
          },
          isPaid: false,
        },
      });
    }

    if (billingType === 'BOLETO' && selectedProvider === 'INTER') {
      const cpfPagador = cpfCnpj || user.cpfCnpj;
      if (!cpfPagador) {
        return NextResponse.json(
          { error: 'CPF/CNPJ é obrigatório para pagamento com boleto' },
          { status: 400 },
        );
      }

      const dueDate = getNextDueDate();
      const pagadorNome = user.name || user.email.split('@')[0];
      const seuNumero = `flix-${user.id.slice(0, 8)}-${Date.now()}`;

      const { codigoSolicitacao } = await createInterCobrancaBoleto({
        seuNumero,
        valor: pricing.totalPrice,
        dataVencimento: dueDate,
        pagador: {
          cpfCnpj: cpfPagador,
          nome: pagadorNome,
          email: user.email,
          phone: user.phone || undefined,
        },
        numDiasAgenda: 0,
        linha1: `${planConfig.name} - Assinatura FlixCRD`,
        linha2: `Pagamento via boleto`,
      });

      const subscriptionData = {
        status: 'PENDING',
        plan: planKey,
        price: pricing.totalPrice,
        asaasCustomerId: null,
        asaasPaymentId: null,
        currentPeriodStart: now,
        currentPeriodEnd: calculatePeriodEnd(now),
      };

      let subscription;
      if (user.Subscription) {
        subscription = await prisma.subscription.update({
          where: { id: user.Subscription.id },
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

      const dbPayment = await prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          asaasPaymentId: codigoSolicitacao,
          status: 'PENDING',
          value: pricing.totalPrice,
          billingType,
          dueDate: new Date(dueDate),
          paymentDate: null,
          invoiceUrl: 'INTER',
          pixQrCode: null,
          pixCopiaECola: null,
        },
      });

      const origin = new URL(request.url).origin;
      const invoiceProxyUrl = `${origin}/api/payments/${dbPayment.id}/invoice`;

      try {
        const planName = planConfig.name;
        const planPrice = `R$ ${pricing.totalPrice.toFixed(2).replace('.', ',')}`;

        await sendMail({
          to: user.email,
          subject: `Boleto de Pagamento - ${planName}`,
          fromEmail: "financeiro@pflix.com.br",
          fromName: "Financeiro FlixCRD",
          meta: {
            reason: "payment-created",
            userId: user.id,
            subscriptionId: subscription.id,
            paymentId: codigoSolicitacao,
            extra: {
              billingType,
              plan: planName,
            },
          },
          context: {
            value: pricing.totalPrice,
            dueDate,
            boletoUrl: invoiceProxyUrl,
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">🎬 FlixCRD - Assinatura ${planName}</h2>
              <p>Olá, ${user.name || 'usuário'}!</p>
              <p>Sua assinatura <strong>${planName}</strong> foi criada com sucesso!</p>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Pagamento via Boleto</h3>
                <p><strong>Valor:</strong> ${planPrice}</p>
                <p><strong>Vencimento:</strong> ${new Date(dueDate).toLocaleDateString('pt-BR')}</p>
              </div>
              <p style="text-align: center;">
                <a href="${invoiceProxyUrl}"
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  📄 Visualizar Boleto
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">
                ⏰ Após a confirmação do pagamento (até 3 dias úteis), sua assinatura será ativada automaticamente.
              </p>
            </div>
          `,
          text: `
FlixCRD - Assinatura ${planName}

Olá, ${user.name || 'usuário'}!

Sua assinatura ${planName} foi criada com sucesso!

Pagamento via Boleto
Valor: ${planPrice}
Vencimento: ${new Date(dueDate).toLocaleDateString('pt-BR')}

Acesse o boleto: ${invoiceProxyUrl}

Após a confirmação do pagamento (até 3 dias úteis), sua assinatura será ativada automaticamente.
          `,
        });
      } catch (emailError) {
        console.error('[Subscription] Erro ao enviar email:', emailError);
      }

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
          id: dbPayment.id,
          status: 'PENDING',
          value: pricing.totalPrice,
          dueDate,
          billingType,
          invoiceUrl: `/api/payments/${dbPayment.id}/invoice`,
          pix: null,
          isPaid: false,
        },
      });
    }

    // Criar ou buscar cliente no Asaas
    const customer = await getOrCreateCustomer({
      name: user.name || user.email.split('@')[0],
      email: user.email,
      cpfCnpj: cpfCnpj || creditCardHolderInfo?.cpfCnpj,
    });

    // Criar cobrança
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

    // PIX é tratado via Inter (early return acima)

    // Criar ou atualizar subscription no banco
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
    if (user.Subscription) {
      subscription = await prisma.subscription.update({
        where: { id: user.Subscription.id },
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

    let paymentInvoiceUrl: string | null = null;
    let pixQrCode: string | null = null;
    let pixCopiaECola: string | null = null;
    let pixExpirationDate: string | null = null;

    if (billingType === 'BOLETO') {
      paymentInvoiceUrl = (payment as any).bankSlipUrl || (payment as any).invoiceUrl || null;
    }

    if (billingType === 'PIX') {
      try {
        const pixData = await getPixQrCode(payment.id);
        pixQrCode = pixData?.encodedImage || null;
        pixCopiaECola = pixData?.payload || null;
        pixExpirationDate = pixData?.expirationDate || null;
      } catch (error) {
        console.error('[Subscription] Falha ao obter QRCode PIX do Asaas:', error);
      }
    }

    // Criar registro de pagamento
    const dbPayment = await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        asaasPaymentId: payment.id,
        status: payment.status,
        value: pricing.totalPrice,
        billingType,
        dueDate: new Date(dueDate),
        paymentDate: isCardApproved ? now : null,
        invoiceUrl: paymentInvoiceUrl,
        pixQrCode,
        pixCopiaECola,
      },
    });

    const origin = new URL(request.url).origin;
    const invoiceProxyUrl = `${origin}/api/payments/${dbPayment.id}/invoice`;

    // Enviar email de confirmação para o usuário
    try {
      const planName = planConfig.name;
      const planPrice = `R$ ${pricing.totalPrice.toFixed(2).replace('.', ',')}`;

      if (billingType === 'CREDIT_CARD' && isCardApproved) {
        // Email de confirmação de pagamento aprovado
        await sendMail({
          to: user.email,
          subject: `Pagamento Aprovado - ${planName}`,
          fromEmail: "financeiro@pflix.com.br",
          fromName: "Financeiro FlixCRD",
          meta: {
            reason: "payment-approved",
            userId: user.id,
            subscriptionId: subscription.id,
            paymentId: payment.id,
            extra: {
              billingType,
              plan: planName,
            },
          },
          context: {
            value: pricing.totalPrice,
            periodEnd: calculatePeriodEnd(now),
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">✅ Pagamento Aprovado!</h2>
              <p>Olá, ${user.name || 'usuário'}!</p>
              <p>Seu pagamento foi aprovado e sua assinatura <strong>${planName}</strong> está ativa! 🎉</p>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Plano:</strong> ${planName}</p>
                <p><strong>Valor:</strong> ${planPrice}</p>
                <p><strong>Período:</strong> ${new Date().toLocaleDateString('pt-BR')} até ${new Date(calculatePeriodEnd(now)).toLocaleDateString('pt-BR')}</p>
              </div>
              <p style="text-align: center;">
                <a href="${new URL(request.url).origin}" 
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
✅ Pagamento Aprovado!

Olá, ${user.name || 'usuário'}!

Seu pagamento foi aprovado e sua assinatura ${planName} está ativa! 🎉

Plano: ${planName}
Valor: ${planPrice}
Período: ${new Date().toLocaleDateString('pt-BR')} até ${new Date(calculatePeriodEnd(now)).toLocaleDateString('pt-BR')}

Acesse: ${new URL(request.url).origin}

Aproveite todo o conteúdo disponível na plataforma!
          `,
        });
      }

      if (billingType === 'PIX') {
        const planPricePix = `R$ ${pricing.totalPrice.toFixed(2).replace('.', ',')}`;
        if (pixQrCode && pixCopiaECola) {
          await sendMail({
            to: user.email,
            subject: `Pagamento PIX - ${planName}`,
            fromEmail: 'financeiro@pflix.com.br',
            fromName: 'Financeiro FlixCRD',
            meta: {
              reason: 'payment-created',
              userId: user.id,
              subscriptionId: subscription.id,
              paymentId: payment.id,
              extra: {
                billingType,
                plan: planName,
                provider: 'ASAAS',
              },
            },
            context: {
              value: pricing.totalPrice,
              dueDate: pixExpirationDate || dueDate,
            },
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #e50914;">🎬 FlixCRD - Assinatura ${planName}</h2>
                <p>Olá, ${user.name || 'usuário'}!</p>
                <p>Sua assinatura <strong>${planName}</strong> foi criada com sucesso!</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Pagamento via PIX</h3>
                  <p><strong>Valor:</strong> ${planPricePix}</p>
                  <p style="font-size: 14px; color: #666;">Escaneie o QR Code abaixo ou use o código Pix Copia e Cola:</p>
                  <div style="text-align: center; margin: 20px 0;">
                    <img src="data:image/png;base64,${pixQrCode}" alt="QR Code PIX" style="max-width: 200px;" />
                  </div>
                  <div style="background-color: #fff; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px; font-family: monospace;">
                    ${pixCopiaECola}
                  </div>
                </div>
                <p style="color: #666; font-size: 14px;">⏰ Após o pagamento, sua assinatura será ativada automaticamente em alguns minutos.</p>
              </div>
            `,
            text: `
FlixCRD - Assinatura ${planName}

Olá, ${user.name || 'usuário'}!

Sua assinatura ${planName} foi criada com sucesso!

Pagamento via PIX
Valor: ${planPricePix}

Código Pix Copia e Cola:
${pixCopiaECola}

Após o pagamento, sua assinatura será ativada automaticamente em alguns minutos.
            `,
          });
        }
      }

      if (billingType === 'BOLETO') {
        const planPriceBoleto = `R$ ${pricing.totalPrice.toFixed(2).replace('.', ',')}`;
        await sendMail({
          to: user.email,
          subject: `Boleto de Pagamento - ${planName}`,
          fromEmail: "financeiro@pflix.com.br",
          fromName: "Financeiro FlixCRD",
          meta: {
            reason: "payment-created",
            userId: user.id,
            subscriptionId: subscription.id,
            paymentId: payment.id,
            extra: {
              billingType,
              plan: planName,
              provider: 'ASAAS',
            },
          },
          context: {
            value: pricing.totalPrice,
            dueDate,
            boletoUrl: invoiceProxyUrl,
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">🎬 FlixCRD - Assinatura ${planName}</h2>
              <p>Olá, ${user.name || 'usuário'}!</p>
              <p>Sua assinatura <strong>${planName}</strong> foi criada com sucesso!</p>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Pagamento via Boleto</h3>
                <p><strong>Valor:</strong> ${planPriceBoleto}</p>
                <p><strong>Vencimento:</strong> ${new Date(dueDate).toLocaleDateString('pt-BR')}</p>
              </div>
              <p style="text-align: center;">
                <a href="${invoiceProxyUrl}"
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  📄 Visualizar Boleto
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">⏰ Após a confirmação do pagamento, sua assinatura será ativada automaticamente.</p>
            </div>
          `,
          text: `
FlixCRD - Assinatura ${planName}

Olá, ${user.name || 'usuário'}!

Sua assinatura ${planName} foi criada com sucesso!

Pagamento via Boleto
Valor: ${planPriceBoleto}
Vencimento: ${new Date(dueDate).toLocaleDateString('pt-BR')}

Acesse o boleto: ${invoiceProxyUrl}
          `,
        });
      }

      console.log(`[Subscription] Email de pagamento enviado para ${user.email} (${billingType})`);
    } catch (emailError) {
      // Não bloqueia a criação da assinatura se o email falhar
      console.error('[Subscription] Erro ao enviar email:', emailError);
    }

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
        id: dbPayment.id,
        status: payment.status,
        value: payment.value,
        dueDate: payment.dueDate,
        billingType,
        invoiceUrl: billingType === 'PIX' ? `/api/payments/${dbPayment.id}/invoice` : dbPayment.invoiceUrl ? `/api/payments/${dbPayment.id}/invoice` : null,
        pix: billingType === 'PIX' && pixQrCode && pixCopiaECola ? {
          qrCode: pixQrCode,
          copiaECola: pixCopiaECola,
          expirationDate: pixExpirationDate || '',
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
        Payment: {
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

    const payments = ((subscription as any).Payment ?? []).map((p: any) => ({
      ...p,
      invoiceUrl: p.invoiceUrl ? `/api/payments/${p.id}/invoice` : null,
    }));

    return NextResponse.json({
      hasSubscription: true,
      isActive,
      subscription: {
        ...subscription,
        payments,
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
