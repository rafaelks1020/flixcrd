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

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AdminSession | null;

    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, password } = body as { id?: string; password?: string };

    if (!id || !password) {
      return NextResponse.json(
        { error: "Parâmetros inválidos. Informe id e nova senha." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    let targetUser: { id: string; email: string; name: string | null } | null = null;
    try {
      targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true },
      });
    } catch {
      targetUser = null;
    }

    if (targetUser?.email) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
        await sendMail({
          to: targetUser.email,
          subject: "Sua senha foi redefinida - FlixCRD",
          fromEmail: "suporte@pflix.com.br",
          fromName: "Suporte FlixCRD",
          meta: {
            reason: "admin-password-reset",
            userId: targetUser.id,
            extra: {
              changedBy: (session.user as any).id,
            },
          },
          context: {
            userId: targetUser.id,
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Senha redefinida</h2>
              <p>Olá, ${targetUser.name || targetUser.email}!</p>
              <p>A senha da sua conta no <strong>FlixCRD</strong> foi redefinida por um administrador.</p>
              <p>Se não foi você que solicitou essa alteração, recomendamos que acesse a plataforma e redefina sua senha novamente usando a opção "Esqueci minha senha".</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/login" 
                   style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Ir para o login
                </a>
              </p>
            </div>
          `,
          text: `
Senha redefinida - FlixCRD

Olá, ${targetUser.name || targetUser.email}!

A senha da sua conta no FlixCRD foi redefinida por um administrador.

Se não foi você que solicitou essa alteração, acesse a plataforma e redefina sua senha novamente usando a opção "Esqueci minha senha".

Acesse: ${appUrl}/login
          `,
        });
      } catch (emailError) {
        console.error("[AdminUsers] Erro ao enviar email de redefinição de senha:", emailError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/admin/users error", error);
    return NextResponse.json(
      { error: "Erro ao atualizar senha do usuário." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AdminSession | null;

    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json(
        { error: "Parâmetros inválidos. Informe id do usuário." },
        { status: 400 },
      );
    }

    const currentUserId = (session.user as any).id as string | undefined;
    if (currentUserId && currentUserId === id) {
      return NextResponse.json(
        { error: "Você não pode excluir o seu próprio usuário." },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.request.updateMany({
        where: { assignedAdminId: id },
        data: {
          assignedAdminId: null,
          assignedAt: null,
        },
      });

      await tx.subscription.deleteMany({ where: { userId: id } });

      await tx.user.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/users error", error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Erro desconhecido";

    return NextResponse.json(
      { error: message || "Erro ao excluir usuário." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AdminSession | null;

    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, role, name, avatar } = body as {
      id?: string;
      role?: string;
      name?: string | null;
      avatar?: string | null;
    };

    if (!id) {
      return NextResponse.json(
        { error: "Parâmetros inválidos. Informe id do usuário." },
        { status: 400 },
      );
    }

    const data: { role?: "ADMIN" | "USER"; name?: string | null; avatar?: string | null } = {};

    if (typeof role !== "undefined") {
      if (role !== "ADMIN" && role !== "USER") {
        return NextResponse.json(
          { error: "Role inválida. Use ADMIN ou USER." },
          { status: 400 },
        );
      }

      // Evita que o admin atual remova o próprio acesso admin por engano
      const currentUserId = session.user?.id;
      if (currentUserId && currentUserId === id && role !== "ADMIN") {
        return NextResponse.json(
          { error: "Você não pode remover seu próprio acesso de administrador." },
          { status: 400 },
        );
      }

      data.role = role;
    }

    if (typeof name !== "undefined") {
      data.name = name ?? null;
    }

    if (typeof avatar !== "undefined") {
      data.avatar = avatar ?? null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/users error", error);
    return NextResponse.json(
      { error: "Erro ao atualizar usuário." },
      { status: 500 },
    );
  }
}
