'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

// Rotas que não precisam de assinatura
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/subscribe',
  '/api',
  '/_next',
  '/favicon.ico',
];

// Rotas que admins podem acessar sem assinatura
const ADMIN_ROUTES = [
  '/admin',
];

export default function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    // Se não está logado ou ainda carregando, não verifica
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      setChecking(false);
      setHasAccess(true); // Deixa passar, o middleware de auth vai redirecionar
      return;
    }

    // Verificar se é rota pública
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
    if (isPublicRoute) {
      setChecking(false);
      setHasAccess(true);
      return;
    }

    // Verificar se é admin
    const isAdmin = (session?.user as any)?.role === 'ADMIN';
    if (isAdmin) {
      setChecking(false);
      setHasAccess(true);
      return;
    }

    // Verificar assinatura
    checkSubscription();
  }, [status, session, pathname]);

  const checkSubscription = async () => {
    try {
      const res = await fetch('/api/subscription/check');
      const data = await res.json();

      if (data.canWatch) {
        setHasAccess(true);
      } else {
        // Redirecionar para página de assinatura
        router.push('/subscribe');
      }
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      // Em caso de erro, redireciona para subscribe por segurança
      router.push('/subscribe');
    } finally {
      setChecking(false);
    }
  };

  // Enquanto verifica, mostra loading
  if (checking && status === 'authenticated') {
    // Verificar se é rota pública para não mostrar loading
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
    if (!isPublicRoute) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Verificando assinatura...</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
