import { prisma } from './prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { redirect } from 'next/navigation';

/**
 * Verifica se o usuário tem uma assinatura ativa
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return false;
  }

  const now = new Date();
  return (
    subscription.status === 'ACTIVE' &&
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd > now
  );
}

/**
 * Busca detalhes da assinatura do usuário
 */
export async function getSubscriptionDetails(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return null;
  }

  const now = new Date();
  const isActive =
    subscription.status === 'ACTIVE' &&
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd > now;

  const daysRemaining =
    isActive && subscription.currentPeriodEnd
      ? Math.ceil(
          (subscription.currentPeriodEnd.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  return {
    ...subscription,
    isActive,
    daysRemaining,
  };
}

/**
 * Verifica e atualiza assinaturas expiradas
 * Pode ser chamado por um cron job
 */
export async function checkExpiredSubscriptions() {
  const now = new Date();

  const expired = await prisma.subscription.updateMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: {
        lt: now,
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return expired.count;
}

/**
 * Ativa manualmente uma assinatura (para admin)
 */
export async function activateSubscription(
  userId: string,
  days: number = 30
): Promise<void> {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + days);

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
    },
    create: {
      userId,
      status: 'ACTIVE',
      plan: 'BASIC',
      price: 10.0,
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
    },
  });
}

/**
 * Cancela uma assinatura
 */
export async function cancelSubscription(userId: string): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: {
      status: 'CANCELED',
    },
  });
}

/**
 * Verifica assinatura no server side e redireciona se não tiver
 * Usar em Server Components
 */
export async function requireSubscription(): Promise<{
  hasAccess: boolean;
  isAdmin: boolean;
  userId: string | null;
}> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { hasAccess: false, isAdmin: false, userId: null };
  }

  const userId = (session.user as any).id;
  const isAdmin = (session.user as any).role === 'ADMIN';

  // Admin sempre tem acesso
  if (isAdmin) {
    return { hasAccess: true, isAdmin: true, userId };
  }

  // Verificar assinatura
  const hasAccess = await hasActiveSubscription(userId);
  
  return { hasAccess, isAdmin: false, userId };
}

/**
 * Redireciona para /subscribe se não tiver assinatura
 * Usar em Server Components
 */
export async function requireSubscriptionOrRedirect(): Promise<void> {
  const { hasAccess, isAdmin } = await requireSubscription();
  
  if (!hasAccess && !isAdmin) {
    redirect('/subscribe');
  }
}
