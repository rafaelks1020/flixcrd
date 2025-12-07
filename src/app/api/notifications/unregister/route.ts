import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { corsHeaders, corsOptionsResponse } from '@/lib/cors';

export async function OPTIONS() {
  return corsOptionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyMobileToken(request);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token é obrigatório' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Desativa o token (não deleta para manter histórico)
    await prisma.pushToken.updateMany({
      where: { 
        token,
        userId: authResult.userId,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error unregistering push token:', error);
    return NextResponse.json(
      { error: 'Erro ao remover token' },
      { status: 500, headers: corsHeaders }
    );
  }
}
