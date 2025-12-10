"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";

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

type SessionUser = Session["user"] & { role?: string };

export function useSubscription() {
  const { status: authStatus } = useSession();
  const [state, setState] = useState<SubscriptionStatus>({
    hasSubscription: false,
    isActive: false,
    loading: true,
    error: null,
  });

  const checkSubscription = useCallback(async () => {
    if (authStatus !== "authenticated") {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      const res = await fetch("/api/subscription/create");
      const data: {
        hasSubscription?: boolean;
        isActive?: boolean;
        subscription?: SubscriptionStatus["subscription"];
        error?: string;
      } = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao verificar assinatura");
      }

      setState({
        hasSubscription: data.hasSubscription ?? false,
        isActive: data.isActive ?? false,
        subscription: data.subscription,
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  }, [authStatus]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...state,
    refresh: checkSubscription,
    isAuthenticated: authStatus === "authenticated",
  };
}

/**
 * Hook simples para verificar se pode assistir
 * Retorna true se tem assinatura ativa ou se é admin
 */
export function useCanWatch() {
  const { isActive, loading } = useSubscription();
  const { data: session } = useSession();

  const sessionUser = session?.user as SessionUser | undefined;
  const isAdmin = sessionUser?.role === "ADMIN";

  return {
    canWatch: isAdmin || isActive,
    loading,
    isAdmin,
    hasActiveSubscription: isActive,
  };
}
