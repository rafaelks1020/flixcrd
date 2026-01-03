import { prisma } from "@/lib/prisma";

/**
 * Verifica se o usuário tem acesso ao LAB
 * Regra: ADMIN ou qualquer plano pago (preço > 0)
 */
export async function hasLabAccess(userId: string, userRole?: string): Promise<boolean> {
  // O usuário quer que TODOS tenham acesso ao LAB sem travas
  return true;
}
