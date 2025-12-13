/**
 * Asaas Payment Gateway Integration
 * API Docs: https://docs.asaas.com/
 */

const ASAAS_API_KEY =
  process.env.ASAAS_API_KEY ||
  (process.env.NODE_ENV === 'production'
    ? process.env.ASAAS_KEY_PRODUCTION || process.env.ASAAS_KEY_PROD
    : process.env.ASAAS_KEY_SANDBOX);

const DEFAULT_ASAAS_API_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

function inferAsaasApiUrlFromKey(key: string | undefined): string | null {
  if (!key) return null;
  const k = key.toLowerCase();
  if (k.includes('_hmlg_') || k.includes('hmlg')) return 'https://sandbox.asaas.com/api/v3';
  if (k.includes('_prod_') || k.includes('prod')) return 'https://api.asaas.com/v3';
  return null;
}

const ASAAS_API_URL =
  process.env.ASAAS_API_URL || inferAsaasApiUrlFromKey(ASAAS_API_KEY) || DEFAULT_ASAAS_API_URL;

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

interface AsaasPayment {
  id: string;
  customer: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  dueDate: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeId?: string;
  pixTransaction?: {
    qrCodeImage: string;
    payload: string;
  };
}

interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  nextDueDate: string;
  cycle: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  status: string;
}

interface CreateCustomerParams {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

interface CreatePaymentParams {
  customer: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  // Campos para cartão de crédito
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
  };
  remoteIp?: string;
}

interface CreateSubscriptionParams {
  customer: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  nextDueDate: string;
  cycle: 'MONTHLY';
  description?: string;
  externalReference?: string;
}

async function asaasRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!ASAAS_API_KEY) {
    throw new Error('Chave do Asaas não configurada (ASAAS_API_KEY/ASAAS_KEY_PROD/ASAAS_KEY_SANDBOX)');
  }

  const response = await fetch(`${ASAAS_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Asaas API Error:', data);
    throw new Error(data.errors?.[0]?.description || 'Erro na API do Asaas');
  }

  return data as T;
}

// ==================== CUSTOMERS ====================

export async function findCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
  const response = await asaasRequest<{ data: AsaasCustomer[] }>(
    `/customers?email=${encodeURIComponent(email)}`
  );
  return response.data?.[0] || null;
}

export async function createCustomer(params: CreateCustomerParams): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getOrCreateCustomer(params: CreateCustomerParams): Promise<AsaasCustomer> {
  const existing = await findCustomerByEmail(params.email);
  if (existing) {
    return existing;
  }
  return createCustomer(params);
}

// ==================== PAYMENTS ====================

export async function createPayment(params: CreatePaymentParams): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>(`/payments/${paymentId}`);
}

export async function getPixQrCode(paymentId: string): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
  return asaasRequest(`/payments/${paymentId}/pixQrCode`);
}

// ==================== SUBSCRIPTIONS ====================

export async function createSubscription(params: CreateSubscriptionParams): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>(`/subscriptions/${subscriptionId}`);
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaasRequest(`/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
  });
}

export async function getSubscriptionPayments(subscriptionId: string): Promise<{ data: AsaasPayment[] }> {
  return asaasRequest(`/subscriptions/${subscriptionId}/payments`);
}

// ==================== HELPERS ====================

export function formatDateForAsaas(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function getNextDueDate(): string {
  const today = new Date();
  return formatDateForAsaas(today);
}

export function calculatePeriodEnd(startDate: Date): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30);
  return endDate;
}

// ==================== PLAN CONFIG ====================

// Taxas do Asaas (aproximadas)
const ASAAS_FEES = {
  PIX: 0.99,           // Taxa fixa PIX
  BOLETO: 1.99,        // Taxa fixa Boleto
  CREDIT_CARD: 0.0349, // 3.49% do valor (taxa variável)
  CREDIT_CARD_FIXED: 0.49, // Taxa fixa cartão
};

export const PLAN_CONFIG = {
  BASIC: {
    name: 'Plano Básico',
    basePrice: 10.00,  // Preço base
    description: 'Acesso completo ao Pflix por 30 dias (1 tela)',
    features: [
      'Acesso completo ao catálogo',
      'Qualidade HD',
      '1 tela simultânea',
      'Até 4 perfis (não simultâneos)',
    ],
  },
  DUO: {
    name: 'Plano Duo',
    basePrice: 14.99,
    description: 'Acesso completo ao Pflix por 30 dias (2 telas)',
    features: [
      'Acesso completo ao catálogo',
      'Qualidade HD',
      '2 telas simultâneas',
      'Até 4 perfis (não simultâneos)',
    ],
  },
};

/**
 * Calcula o preço final com repasse de taxas
 */
export function calculateFinalPrice(
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD',
  plan: keyof typeof PLAN_CONFIG = 'BASIC',
): {
  basePrice: number;
  fee: number;
  totalPrice: number;
  feeDescription: string;
} {
  const basePrice = PLAN_CONFIG[plan].basePrice;
  
  switch (billingType) {
    case 'PIX':
      return {
        basePrice,
        fee: ASAAS_FEES.PIX,
        totalPrice: basePrice + ASAAS_FEES.PIX,
        feeDescription: `Taxa PIX: R$ ${ASAAS_FEES.PIX.toFixed(2)}`,
      };
    
    case 'BOLETO':
      return {
        basePrice,
        fee: ASAAS_FEES.BOLETO,
        totalPrice: basePrice + ASAAS_FEES.BOLETO,
        feeDescription: `Taxa Boleto: R$ ${ASAAS_FEES.BOLETO.toFixed(2)}`,
      };
    
    case 'CREDIT_CARD':
      // Para cartão, precisamos calcular o valor que, após a taxa, resulte no valor base
      // Fórmula: valorFinal = (valorBase + taxaFixa) / (1 - taxaPercentual)
      const taxaPercentual = ASAAS_FEES.CREDIT_CARD;
      const taxaFixa = ASAAS_FEES.CREDIT_CARD_FIXED;
      const totalPrice = (basePrice + taxaFixa) / (1 - taxaPercentual);
      const fee = totalPrice - basePrice;
      
      return {
        basePrice,
        fee: Math.round(fee * 100) / 100,
        totalPrice: Math.round(totalPrice * 100) / 100,
        feeDescription: `Taxa Cartão: R$ ${fee.toFixed(2)} (3.49% + R$0.49)`,
      };
    
    default:
      return {
        basePrice,
        fee: 0,
        totalPrice: basePrice,
        feeDescription: '',
      };
  }
}

export type PlanType = keyof typeof PLAN_CONFIG;
export type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD';
