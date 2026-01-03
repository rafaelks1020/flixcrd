import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getOrCreateCustomer } from '@/lib/asaas';
import { sendMail } from '@/lib/mailjet';
import { rateLimit, getClientIP } from '@/lib/rate-limit-store';

const db = prisma as any;

// Rate limiter for auth endpoints (5 requests per 15 minutes)
const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const ip = getClientIP(request);
    const rateLimitResult = authRateLimit(ip);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many authentication attempts, please try again later.',
          limit: rateLimitResult.limit,
          resetTime: rateLimitResult.resetTime
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          }
        }
      );
    }
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
      const loginUrl = `${String(appUrl).replace(/\/$/, "")}/login`;

      await sendMail({
        to: user.email,
        subject: 'Cadastro recebido - FlixCRD',
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
            <h2 style="color: #e50914;">Cadastro recebido</h2>
            <p>Olá, ${user.name || user.email}!</p>
            <p>Sua conta foi criada e está aguardando aprovação.</p>
            <p>Você receberá um email assim que seu acesso for liberado.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Acompanhar cadastro
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              Se você não reconhece este cadastro, responda este email ou entre em contato com o suporte.
            </p>
          </div>
        `,
        text: `
Cadastro recebido - FlixCRD

Olá, ${user.name || user.email}!

Sua conta foi criada e está aguardando aprovação.
Você receberá um email assim que seu acesso for liberado.

Acompanhe em: ${loginUrl}

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
