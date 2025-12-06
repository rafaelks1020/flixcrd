import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getOrCreateCustomer } from '@/lib/asaas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, cpfCnpj } = body;

    // Validações
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    if (!cpfCnpj || cpfCnpj.length !== 11) {
      return NextResponse.json(
        { error: 'CPF é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 400 }
      );
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        cpfCnpj,
        passwordHash,
        role: 'USER',
      },
    });

    // Criar cliente no Asaas automaticamente
    try {
      const asaasCustomer = await getOrCreateCustomer({
        name: user.name || email.split('@')[0],
        email: user.email,
        cpfCnpj: cpfCnpj,
      });

      // Criar subscription pendente (sem pagamento ainda)
      await prisma.subscription.create({
        data: {
          userId: user.id,
          status: 'PENDING',
          plan: 'BASIC',
          price: 10.00,
          asaasCustomerId: asaasCustomer.id,
        },
      });

      console.log(`[Register] Cliente Asaas criado: ${asaasCustomer.id}`);
    } catch (asaasError) {
      // Se falhar no Asaas, não impede o registro
      console.error('[Register] Erro ao criar cliente no Asaas:', asaasError);
    }

    // Criar perfil padrão
    await prisma.profile.create({
      data: {
        userId: user.id,
        name: user.name || 'Perfil 1',
        isKids: false,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

  } catch (error: any) {
    console.error('[Register] Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar conta' },
      { status: 500 }
    );
  }
}
