import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface AdminSession {
  user: { id: string; role: string; email: string };
}

/**
 * Verifica se o usuário autenticado é admin.
 * Retorna a session tipada se for admin, ou null caso contrário.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !session.user ||
    (session.user as AdminSession["user"]).role !== "ADMIN"
  ) {
    return null;
  }

  return session as unknown as AdminSession;
}
