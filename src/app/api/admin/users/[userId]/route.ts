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

/**
 * Update user profile or role (PATCH)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        const session = await getServerSession(authOptions) as AdminSession | null;

        if (!session || !session.user || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { role, name, avatar, password } = body as {
            role?: string;
            name?: string | null;
            avatar?: string | null;
            password?: string;
        };

        if (!userId) {
            return NextResponse.json({ error: "ID do usuário não fornecido." }, { status: 400 });
        }

        // Special case: Password Update
        if (password) {
            if (password.length < 6) {
                return NextResponse.json(
                    { error: "A senha deve ter pelo menos 6 caracteres." },
                    { status: 400 },
                );
            }
            const passwordHash = await bcrypt.hash(password, 10);
            await prisma.user.update({
                where: { id: userId },
                data: { passwordHash },
            });

            // Send email (optional/best effort)
            const targetUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, name: true },
            });

            if (targetUser?.email) {
                try {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
                    await sendMail({
                        to: targetUser.email,
                        subject: "Sua senha foi redefinida - FlixCRD",
                        fromEmail: "suporte@pflix.com.br",
                        fromName: "Suporte FlixCRD",
                        meta: { reason: "admin-password-reset", userId: targetUser.id },
                        context: { userId: targetUser.id },
                        html: `<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Senha redefinida</h2>
              <p>Olá, ${targetUser.name || targetUser.email}!</p>
              <p>Sua senha no <strong>FlixCRD</strong> foi redefinida por um administrador.</p>
              <a href="${appUrl}/login" style="background: #e50914; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Ir para o login</a>
            </div>`
                    });
                } catch (e) { console.error("Email error", e); }
            }

            return NextResponse.json({ ok: true });
        }

        // Standard Profile/Role Update
        const data: any = {};
        if (typeof role !== "undefined") {
            if (role !== "ADMIN" && role !== "USER") {
                return NextResponse.json({ error: "Role inválida." }, { status: 400 });
            }
            // Prevention: Don't let current admin demote themselves
            if (session.user.id === userId && role !== "ADMIN") {
                return NextResponse.json({ error: "Você não pode remover seu próprio acesso ADMIN." }, { status: 400 });
            }
            data.role = role;
        }
        if (typeof name !== "undefined") data.name = name ?? null;
        if (typeof avatar !== "undefined") data.avatar = avatar ?? null;

        const updated = await prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, email: true, name: true, avatar: true, role: true, createdAt: true },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PATCH /api/admin/users/[userId] error", error);
        return NextResponse.json({ error: "Erro ao atualizar usuário." }, { status: 500 });
    }
}

/**
 * Delete/Ban User (DELETE)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        const session = await getServerSession(authOptions) as AdminSession | null;

        if (!session || !session.user || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
        }

        if (!userId) {
            return NextResponse.json({ error: "ID do usuário não fornecido." }, { status: 400 });
        }

        if (session.user.id === userId) {
            return NextResponse.json({ error: "Você não pode excluir o seu próprio usuário." }, { status: 400 });
        }

        // Using transaction for safety (Handled by Cascade in DB too, but keeping logic consistent)
        await prisma.$transaction(async (tx) => {
            // Clear sessions first
            await tx.userPresenceSession.deleteMany({ where: { userId } });

            // Clear subscription (already has Cascade if applied, but safe to keep)
            await tx.subscription.deleteMany({ where: { userId } });

            // Delete the user
            await tx.user.delete({ where: { id: userId } });
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("DELETE /api/admin/users/[userId] error", error);
        return NextResponse.json({ error: "Erro ao excluir usuário." }, { status: 500 });
    }
}
