import { NextResponse } from 'next/server';
import { calculateFinalPrice, PLAN_CONFIG } from '@/lib/asaas';

/**
 * Retorna os preços do plano com taxas calculadas
 */
export async function GET() {
  const plan = PLAN_CONFIG.BASIC;
  
  const pixPricing = calculateFinalPrice('PIX');
  const cardPricing = calculateFinalPrice('CREDIT_CARD');
  const boletoPricing = calculateFinalPrice('BOLETO');

  return NextResponse.json({
    plan: {
      name: plan.name,
      basePrice: plan.basePrice,
      description: plan.description,
      features: plan.features,
    },
    pricing: {
      PIX: {
        basePrice: pixPricing.basePrice,
        fee: pixPricing.fee,
        totalPrice: pixPricing.totalPrice,
        feeDescription: pixPricing.feeDescription,
      },
      CREDIT_CARD: {
        basePrice: cardPricing.basePrice,
        fee: cardPricing.fee,
        totalPrice: cardPricing.totalPrice,
        feeDescription: cardPricing.feeDescription,
      },
      BOLETO: {
        basePrice: boletoPricing.basePrice,
        fee: boletoPricing.fee,
        totalPrice: boletoPricing.totalPrice,
        feeDescription: boletoPricing.feeDescription,
      },
    },
  });
}
