import { prisma } from "@/lib/prisma";

/**
 * Verifica se o usuário tem acesso ao LAB
 * Regra: ADMIN ou qualquer plano pago (preço > 0)
 */
export async function hasLabAccess(userId: string, userRole?: string): Promise<boolean> {
  // Admin sempre tem acesso
  if (userRole === "ADMIN") {
    return true;
  }

  // Verificar se tem assinatura ativa com preço > 0
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      status: true,
      currentPeriodEnd: true,
      price: true,
    },
  });

  if (!subscription) {
    return false;
  }

  // Verificar se está ativa
  const now = new Date();
  const isActive = 
    subscription.status === "ACTIVE" && 
    subscription.currentPeriodEnd && 
    subscription.currentPeriodEnd > now;

  if (!isActive) {
    return false;
  }

  // Verificar se é plano pago (preço > 0)
  const price = subscription.price || 0;
  return price > 0;
}
