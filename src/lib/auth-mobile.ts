import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import jwt from "jsonwebtoken";

import { authOptions } from "./auth";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

/**
 * Obtém o usuário autenticado de session (web) ou JWT (mobile)
 */
export async function getAuthUser(request?: NextRequest): Promise<AuthUser | null> {
  // Primeiro tenta JWT do header Authorization (mobile)
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        return decoded;
      } catch {
        // Token inválido, continua para tentar session
      }
    }
  }

  // Fallback para session do NextAuth (web)
  try {
    const session: any = await getServerSession(authOptions);
    if (session?.user?.id) {
      return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role || "USER",
      };
    }
  } catch {
    // Sem session
  }

  return null;
}
