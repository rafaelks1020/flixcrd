import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

import { prisma } from './prisma';

function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET não configurado para autenticação mobile');
  }
  return secret;
}

interface TokenPayload {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  user?: TokenPayload;
  error?: string;
}

/**
 * Verifica o token JWT do app mobile
 */
export async function verifyMobileToken(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Token não fornecido' };
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret) as { id?: string };
      if (!decoded?.id) {
        return { success: false, error: 'Token inválido ou expirado' };
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, name: true, role: true },
      });
      if (!dbUser) {
        return { success: false, error: 'Token inválido ou expirado' };
      }

      return {
        success: true,
        userId: dbUser.id,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name ?? undefined,
          role: dbUser.role || 'USER',
        },
      };
    } catch {
      return { success: false, error: 'Token inválido ou expirado' };
    }
  } catch (error) {
    console.error('Error verifying mobile token:', error);
    return { success: false, error: 'Erro ao verificar token' };
  }
}

/**
 * Extrai o userId do token (versão simplificada)
 */
export function getUserIdFromToken(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as TokenPayload;
    
    return decoded.id;
  } catch {
    return null;
  }
}
