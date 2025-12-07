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
    const { token, platform, deviceName } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token é obrigatório' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Upsert do token (atualiza se já existe, cria se não)
    await prisma.pushToken.upsert({
      where: { token },
      update: {
        userId: authResult.userId,
        platform: platform || 'unknown',
        deviceName: deviceName || null,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: authResult.userId,
        token,
        platform: platform || 'unknown',
        deviceName: deviceName || null,
        isActive: true,
      },
    });

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error registering push token:', error);
    return NextResponse.json(
      { error: 'Erro ao registrar token' },
      { status: 500, headers: corsHeaders }
    );
  }
}
