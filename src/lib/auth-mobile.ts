import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import jwt from "jsonwebtoken";

import { authOptions } from "./auth";

function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET não configurado para autenticação mobile");
  }
  return secret;
}

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
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret) as AuthUser;
        return decoded;
      } catch {
        // Token inválido, continua para tentar session
      }
    }
  }

  // Fallback para session do NextAuth (web)
  try {
    type SessionUser = {
      id: string;
      email: string;
      name?: string | null;
      role?: string;
    };

    type SessionLike = {
      user?: SessionUser;
    } | null;

    const rawSession = await getServerSession(authOptions);
    const session = rawSession as SessionLike;
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
