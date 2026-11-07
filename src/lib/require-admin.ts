import { NextResponse } from "next/server";
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

/**
 * Checagem de ADMIN para o início do handler.
 * null significa que a rota pode continuar.
 */
export async function adminDenied(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  return null;
}
