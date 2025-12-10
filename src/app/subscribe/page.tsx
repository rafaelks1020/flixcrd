'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface PricingInfo {
  basePrice: number;
  fee: number;
  totalPrice: number;
  feeDescription: string;
}

interface PaymentData {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  billingType: string;
  invoiceUrl?: string;
  isPaid?: boolean;
  pix?: {
    qrCode: string;
    copiaECola: string;
    expirationDate: string;
  };
}

interface SubscriptionData {
  hasSubscription: boolean;
  isActive: boolean;
  subscription?: {
    status: string;
    plan: string;
    currentPeriodEnd: string;
    daysRemaining: number;
  };
}

type BillingType = 'PIX' | 'CREDIT_CARD';
type PlanKey = 'BASIC' | 'DUO';

export default function SubscribePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [pricingInfo, setPricingInfo] = useState<PricingInfo | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [billingType, setBillingType] = useState<BillingType>('PIX');
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('BASIC');
  
  // Dados do cartão
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [phone, setPhone] = useState('');

  // Preços calculados por plano (mantidos em sync com lib/asaas.ts)
  const planPrices: Record<PlanKey, {
    PIX: { base: number; fee: number; total: number };
    CREDIT_CARD: { base: number; fee: number; total: number };
  }> = {
    BASIC: {
      PIX: { base: 10.00, fee: 0.99, total: 10.99 },
      CREDIT_CARD: { base: 10.00, fee: 0.86, total: 10.86 },
    },
    DUO: {
      PIX: { base: 14.99, fee: 0.99, total: 15.98 },
      CREDIT_CARD: { base: 14.99, fee: 1.05, total: 16.04 },
    },
  };

  const currentPrices = planPrices[selectedPlan];
  const currentPlanLabel = selectedPlan === 'DUO'
    ? 'Plano Duo (2 telas)'
    : 'Plano Básico (1 tela)';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      fetchSubscription();
    }
  }, [status, router]);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/subscription/create');
      const data = await res.json();
      setSubscriptionData(data);
      
      // Se tem pagamento pendente, buscar dados
      if (data.subscription?.status === 'PENDING' && data.subscription?.payments?.[0]) {
        const lastPayment = data.subscription.payments[0];
        if (lastPayment.status === 'PENDING') {
          setPaymentData({
            id: lastPayment.asaasPaymentId,
            status: lastPayment.status,
            value: lastPayment.value,
            dueDate: lastPayment.dueDate,
            billingType: lastPayment.billingType,
            invoiceUrl: lastPayment.invoiceUrl,
            pix: lastPayment.pixQrCode ? {
              qrCode: lastPayment.pixQrCode,
              copiaECola: lastPayment.pixCopiaECola,
              expirationDate: '',
            } : undefined,
          });
        }
      }
    } catch (err) {
      console.error('Erro ao buscar assinatura:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setCreating(true);
    setError('');

    try {
      const payload: any = {
        billingType,
        cpfCnpj: cpf.replace(/\D/g, ''),
        plan: selectedPlan,
      };

      // Adicionar dados do cartão se for cartão
      if (billingType === 'CREDIT_CARD') {
        if (!cardNumber || !cardName || !cardExpiry || !cardCvv || !cpf || !cep || !addressNumber) {
          throw new Error('Preencha todos os campos do cartão');
        }

        const [expiryMonth, expiryYear] = cardExpiry.split('/');
        
        payload.creditCard = {
          holderName: cardName,
          number: cardNumber.replace(/\s/g, ''),
          expiryMonth: expiryMonth,
          expiryYear: `20${expiryYear}`,
          ccv: cardCvv,
        };
        
        payload.creditCardHolderInfo = {
          name: cardName,
          cpfCnpj: cpf.replace(/\D/g, ''),
          postalCode: cep.replace(/\D/g, ''),
          addressNumber: addressNumber,
          phone: phone.replace(/\D/g, '') || undefined,
        };
      }

      const res = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar assinatura');
      }

      setPricingInfo(data.pricing);
      setPaymentData(data.payment);
      
      // Se cartão foi aprovado, redirecionar
      if (data.payment.isPaid) {
        router.push('/browse');
      } else {
        fetchSubscription();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar assinatura");
    } finally {
      setCreating(false);
    }
  };

  const copyPixCode = () => {
    if (paymentData?.pix?.copiaECola) {
      navigator.clipboard.writeText(paymentData.pix.copiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // Formatadores
  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 16);
    return numbers.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 4);
    if (numbers.length >= 2) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    }
    return numbers;
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    return numbers.replace(/(\d{5})(\d)/, '$1-$2');
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3');
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // Se já tem assinatura ativa
  if (subscriptionData?.isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 py-12 px-4">
        <div className="max-w-xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Assinatura Ativa!</h1>
              <p className="text-gray-400">Você tem acesso completo ao Pflix</p>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Plano</span>
                <span className="text-white font-medium">
                  {subscriptionData.subscription?.plan === 'DUO'
                    ? 'Duo (2 telas)'
                    : 'Básico (1 tela)'}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Status</span>
                <span className="text-green-500 font-medium">Ativo</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Dias restantes</span>
                <span className="text-white font-medium">{subscriptionData.subscription?.daysRemaining} dias</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/browse')}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              Ir para o Catálogo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se já gerou um pagamento PIX pendente
  if (paymentData?.pix && paymentData.status === 'PENDING') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">Pagamento via PIX</h1>
              <p className="text-gray-400">Escaneie o QR Code ou copie o código</p>
            </div>

            {/* QR Code */}
            <div className="bg-white rounded-xl p-4 mb-6 flex justify-center">
              <img
                src={`data:image/png;base64,${paymentData.pix.qrCode}`}
                alt="QR Code PIX"
                className="w-64 h-64"
              />
            </div>

            {/* Valor */}
            <div className="text-center mb-4">
              <div className="text-gray-400 text-sm mb-1">Valor total:</div>
              <span className="text-4xl font-bold text-white">
                R$ {paymentData.value.toFixed(2).replace('.', ',')}
              </span>
              <div className="text-gray-500 text-xs mt-1">
                Valor já inclui taxas e encargos.
              </div>
            </div>

            {/* Código Copia e Cola */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block">Código PIX Copia e Cola:</label>
              <div className="bg-gray-900 rounded-lg p-3 flex items-center gap-2">
                <input
                  type="text"
                  value={paymentData.pix.copiaECola}
                  readOnly
                  className="flex-1 bg-transparent text-white text-sm truncate outline-none"
                />
                <button
                  onClick={copyPixCode}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <p className="text-yellow-500 text-sm text-center">
                ⏰ Após o pagamento, sua assinatura será ativada automaticamente em alguns segundos.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={fetchSubscription}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                Verificar Pagamento
              </button>
              <button
                onClick={() => {
                  setPaymentData(null);
                  setPricingInfo(null);
                }}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela de escolha de pagamento
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-zinc-950 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header Premium */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-red-400 text-sm font-medium">Oferta especial</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Assine o <span className="text-red-500">Pflix</span>
          </h1>
          <p className="text-gray-400 text-lg">Entretenimento ilimitado por um preço justo</p>
        </div>

        {/* Cards dos Planos */}
        <div className="grid gap-4 mb-8">
          {/* Plano Básico */}
          <button
            type="button"
            onClick={() => setSelectedPlan('BASIC')}
            className={`group relative w-full text-left p-6 rounded-2xl border transition-all duration-300 ${
              selectedPlan === 'BASIC'
                ? 'border-red-500 bg-gradient-to-br from-red-500/10 to-transparent shadow-xl shadow-red-500/10'
                : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Radio visual */}
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedPlan === 'BASIC' ? 'border-red-500 bg-red-500' : 'border-zinc-600'
                }`}>
                  {selectedPlan === 'BASIC' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Básico</h3>
                  <p className="text-zinc-400 text-sm">1 tela • HD • 4 perfis</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">R$ 10</div>
                <div className="text-zinc-500 text-sm">/mês</div>
              </div>
            </div>
          </button>

          {/* Plano Duo */}
          <button
            type="button"
            onClick={() => setSelectedPlan('DUO')}
            className={`group relative w-full text-left p-6 rounded-2xl border transition-all duration-300 ${
              selectedPlan === 'DUO'
                ? 'border-amber-500 bg-gradient-to-br from-amber-500/10 to-transparent shadow-xl shadow-amber-500/10'
                : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
            }`}
          >
            {/* Badge Popular */}
            <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold uppercase tracking-wider shadow-lg">
              Mais popular
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Radio visual */}
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedPlan === 'DUO' ? 'border-amber-500 bg-amber-500' : 'border-zinc-600'
                }`}>
                  {selectedPlan === 'DUO' && (
                    <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Duo</h3>
                  <p className="text-zinc-400 text-sm">2 telas • HD • 4 perfis</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">R$ 14,99</div>
                <div className="text-zinc-500 text-sm">/mês</div>
              </div>
            </div>
          </button>
        </div>

        {/* Detalhes do plano selecionado */}
        <div className="bg-zinc-900/80 backdrop-blur rounded-2xl p-6 border border-zinc-800 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">
            O que está incluso no plano {selectedPlan === 'DUO' ? 'Duo' : 'Básico'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">{selectedPlan === 'DUO' ? '2 telas' : '1 tela'}</div>
                <div className="text-zinc-500 text-sm">simultâneas</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">Qualidade HD</div>
                <div className="text-zinc-500 text-sm">1080p</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">4 perfis</div>
                <div className="text-zinc-500 text-sm">não simultâneos</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">Sem anúncios</div>
                <div className="text-zinc-500 text-sm">experiência limpa</div>
              </div>
            </div>
          </div>
        </div>

        {/* Método de Pagamento */}
        <div className="bg-zinc-900/80 backdrop-blur rounded-2xl p-6 border border-zinc-800 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Forma de Pagamento</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setBillingType('PIX')}
              className={`p-5 rounded-xl border-2 transition-all duration-300 ${
                billingType === 'PIX'
                  ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
              }`}
            >
              <div className="text-3xl mb-2">💠</div>
              <div className="text-white font-semibold text-lg">PIX</div>
              <div className="text-green-400 text-xl font-bold mt-1">
                R$ {currentPrices.PIX.total.toFixed(2).replace('.', ',')}
              </div>
              <div className="text-zinc-500 text-xs mt-1">
                Taxa: R$ {currentPrices.PIX.fee.toFixed(2).replace('.', ',')}
              </div>
            </button>
            
            <button
              onClick={() => setBillingType('CREDIT_CARD')}
              className={`p-5 rounded-xl border-2 transition-all duration-300 ${
                billingType === 'CREDIT_CARD'
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
              }`}
            >
              <div className="text-3xl mb-2">💳</div>
              <div className="text-white font-semibold text-lg">Cartão</div>
              <div className="text-blue-400 text-xl font-bold mt-1">
                R$ {currentPrices.CREDIT_CARD.total.toFixed(2).replace('.', ',')}
              </div>
              <div className="text-zinc-500 text-xs mt-1">
                Taxa: R$ {currentPrices.CREDIT_CARD.fee.toFixed(2).replace('.', ',')}
              </div>
            </button>
          </div>

          {/* Formulário PIX */}
          {billingType === 'PIX' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">CPF (opcional)</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-all"
                />
              </div>
            </div>
          )}

          {/* Formulário Cartão */}
          {billingType === 'CREDIT_CARD' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Número do Cartão *</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                />
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Nome no Cartão *</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  placeholder="NOME COMO ESTÁ NO CARTÃO"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Validade *</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/AA"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">CVV *</label>
                  <input
                    type="text"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="000"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-700 pt-4 mt-4">
                <p className="text-zinc-500 text-sm mb-4">Dados do titular</p>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">CPF do Titular *</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">CEP *</label>
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => setCep(formatCep(e.target.value))}
                    placeholder="00000-000"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Número *</label>
                  <input
                    type="text"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    placeholder="123"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Telefone (opcional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Resumo e Botão */}
        <div className="bg-zinc-900/80 backdrop-blur rounded-2xl p-6 border border-zinc-800 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-zinc-400 text-sm">Total a pagar</div>
              <div className="text-3xl font-bold text-white">
                R$ {currentPrices[billingType].total.toFixed(2).replace('.', ',')}
              </div>
              <div className="text-zinc-500 text-xs mt-1">
                {currentPlanLabel} + taxa {billingType === 'PIX' ? 'PIX' : 'cartão'}
              </div>
            </div>
            <div className="text-right text-sm text-zinc-400">
              <div>Plano: R$ {currentPrices[billingType].base.toFixed(2).replace('.', ',')}</div>
              <div>Taxa: R$ {currentPrices[billingType].fee.toFixed(2).replace('.', ',')}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={creating}
          className="w-full py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-zinc-700 disabled:to-zinc-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-300 text-lg shadow-lg shadow-red-500/20 hover:shadow-red-500/30"
        >
          {creating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processando...
            </span>
          ) : (
            `Assinar por R$ ${currentPrices[billingType].total.toFixed(2).replace('.', ',')}/mês`
          )}
        </button>

        <p className="text-center text-zinc-500 text-xs mt-6">
          🔒 Pagamento seguro • Cancele quando quiser
        </p>
      </div>
    </div>
  );
}
