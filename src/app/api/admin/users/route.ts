import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { sendMail } from "@/lib/mailjet";

interface SessionUser {
  id?: string;
  email?: string;
  name?: string | null;
  role?: string;
}

interface AdminSession {
  user?: SessionUser;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as AdminSession | null;

    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/admin/users error", error);
    return NextResponse.json(
      { error: "Erro ao listar usuários." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AdminSession | null;

    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { email, name, password, role } = body as {
      email?: string;
      name?: string | null;
      password?: string;
      role?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Já existe um usuário com este email." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const finalRole = role === "ADMIN" ? "ADMIN" : "USER";

    const created = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash,
        role: finalRole as any,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      await sendMail({
        to: created.email,
        subject: "Sua conta FlixCRD foi criada",
        fromEmail: "suporte@pflix.com.br",
        fromName: "Suporte FlixCRD",
        meta: {
          reason: "admin-user-created",
          userId: created.id,
          extra: {
            createdBy: (session.user as any).id,
          },
        },
        context: {
          userId: created.id,
          email: created.email,
        },
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e50914;">Conta criada no FlixCRD</h2>
            <p>Olá, ${created.name || created.email}!</p>
            <p>Um administrador criou uma conta para você no <strong>FlixCRD</strong>.</p>
            <p>Para acessar com segurança, utilize a opção "Esqueci minha senha" na tela de login e defina uma nova senha.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/login" 
                 style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Ir para o login
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              Se você não reconhece esta criação de conta, responda este email ou entre em contato com o suporte.
            </p>
          </div>
        `,
        text: `
Conta criada no FlixCRD

Olá, ${created.name || created.email}!

Um administrador criou uma conta para você no FlixCRD.
Para acessar com segurança, utilize a opção "Esqueci minha senha" na tela de login e defina uma nova senha.

Acesse: ${appUrl}/login

Se você não reconhece esta criação de conta, entre em contato com o suporte.
        `,
      });
    } catch (emailError) {
      console.error("[AdminUsers] Erro ao enviar email de criação de usuário:", emailError);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/users error", error);
    return NextResponse.json(
      { error: "Erro ao criar usuário." },
      { status: 500 },
    );
  }
}

