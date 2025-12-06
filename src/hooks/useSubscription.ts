'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface SubscriptionStatus {
  hasSubscription: boolean;
  isActive: boolean;
  subscription?: {
    id: string;
    status: string;
    plan: string;
    price: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    daysRemaining: number;
  };
  loading: boolean;
  error: string | null;
}

export function useSubscription() {
  const { data: session, status: authStatus } = useSession();
  const [state, setState] = useState<SubscriptionStatus>({
    hasSubscription: false,
    isActive: false,
    loading: true,
    error: null,
  });

  const checkSubscription = useCallback(async () => {
    if (authStatus !== 'authenticated') {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const res = await fetch('/api/subscription/create');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao verificar assinatura');
      }

      setState({
        hasSubscription: data.hasSubscription,
        isActive: data.isActive,
        subscription: data.subscription,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  }, [authStatus]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...state,
    refresh: checkSubscription,
    isAuthenticated: authStatus === 'authenticated',
  };
}

/**
 * Hook simples para verificar se pode assistir
 * Retorna true se tem assinatura ativa ou se é admin
 */
export function useCanWatch() {
  const { isActive, loading } = useSubscription();
  const { data: session } = useSession();
  
  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  
  return {
    canWatch: isAdmin || isActive,
    loading,
    isAdmin,
    hasActiveSubscription: isActive,
  };
}
