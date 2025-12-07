import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { corsHeaders, corsOptionsResponse } from '@/lib/cors';

export async function OPTIONS() {
  return corsOptionsResponse();
}

// GET - Obter preferências
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyMobileToken(request);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401, headers: corsHeaders }
      );
    }

    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId: authResult.userId },
    });

    // Retorna defaults se não existir
    return NextResponse.json(
      preferences || {
        newContent: true,
        updates: true,
        recommendations: true,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return NextResponse.json(
      { error: 'Erro ao obter preferências' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PUT - Atualizar preferências
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyMobileToken(request);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { newContent, updates, recommendations } = body;

    await prisma.notificationPreference.upsert({
      where: { userId: authResult.userId },
      update: {
        ...(newContent !== undefined && { newContent }),
        ...(updates !== undefined && { updates }),
        ...(recommendations !== undefined && { recommendations }),
        updatedAt: new Date(),
      },
      create: {
        userId: authResult.userId,
        newContent: newContent ?? true,
        updates: updates ?? true,
        recommendations: recommendations ?? true,
      },
    });

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar preferências' },
      { status: 500, headers: corsHeaders }
    );
  }
}
