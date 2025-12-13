import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token é obrigatório" },
        { status: 400 },
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Senha deve ter pelo menos 6 caracteres" },
        { status: 400 },
      );
    }

    // Buscar token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { User: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Token inválido ou expirado" },
        { status: 400 },
      );
    }

    // Verificar se o token expirou
    if (resetToken.expiresAt < new Date()) {
      // Deletar token expirado
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });

      return NextResponse.json(
        { error: "Token expirado. Solicite uma nova recuperação de senha." },
        { status: 400 },
      );
    }

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Atualizar senha do usuário
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Deletar token usado
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    });

    // Deletar todos os outros tokens do usuário (por segurança)
    await prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    });

    console.log(
      `[ResetPassword] Senha redefinida para usuário ${resetToken.User.email}`,
    );

    return NextResponse.json({
      success: true,
      message: "Senha redefinida com sucesso!",
    });
  } catch (error: any) {
    console.error("[ResetPassword] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao redefinir senha" },
      { status: 500 },
    );
  }
}


