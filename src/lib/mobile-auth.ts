import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret';

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
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      
      return {
        success: true,
        userId: decoded.id,
        user: decoded,
      };
    } catch (jwtError) {
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
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    
    return decoded.id;
  } catch {
    return null;
  }
}
