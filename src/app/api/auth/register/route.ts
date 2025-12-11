import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getOrCreateCustomer } from '@/lib/asaas';
import { sendMail } from '@/lib/mailjet';

const db = prisma as any;

export async function POST(request: NextRequest) {
  try {
    // Verificar se novos cadastros estão permitidos
    const settings = await db.settings.findFirst().catch(() => null);
    if (settings && settings.allowRegistration === false) {
      return NextResponse.json(
        { error: 'Novos cadastros estão temporariamente desativados.' },
        { status: 403 }
      );
    }

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

    await prisma.profile.create({
      data: {
        userId: user.id,
        name: user.name || 'Perfil 1',
        isKids: false,
      },
    });

    // Enviar email de boas-vindas (não bloqueia o fluxo em caso de erro)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

      await sendMail({
        to: user.email,
        subject: 'Bem-vindo ao FlixCRD',
        fromEmail: 'suporte@pflix.com.br',
        fromName: 'Suporte FlixCRD',
        meta: {
          reason: 'user-registered',
          userId: user.id,
          extra: {
            source: 'auth-register',
          },
        },
        context: {
          userId: user.id,
          email: user.email,
        },
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e50914;">Bem-vindo ao FlixCRD!</h2>
            <p>Olá, ${user.name || user.email}!</p>
            <p>Sua conta foi criada com sucesso.</p>
            <p>Agora é só ativar ou renovar sua assinatura para começar a assistir.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}" 
                 style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Acessar FlixCRD
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              Se você não reconhece este cadastro, responda este email ou entre em contato com o suporte.
            </p>
          </div>
        `,
        text: `
Bem-vindo ao FlixCRD!

Olá, ${user.name || user.email}!

Sua conta foi criada com sucesso.
Agora é só ativar ou renovar sua assinatura para começar a assistir.

Acesse: ${appUrl}

Se você não reconhece este cadastro, entre em contato com o suporte.
        `,
      });
    } catch (emailError) {
      console.error('[Register] Erro ao enviar email de boas-vindas:', emailError);
    }

    return NextResponse.json({
      success: true,
      User: {
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
