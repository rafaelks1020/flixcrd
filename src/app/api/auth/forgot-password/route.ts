import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailjet";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email é obrigatório" },
        { status: 400 },
      );
    }

    // Buscar usuário pelo email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Por segurança, sempre retornamos sucesso mesmo se o email não existir
    // Isso previne que atacantes descubram quais emails estão cadastrados
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "Se o email existir, você receberá um link de recuperação.",
      });
    }

    // Gerar token aleatório
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

    // Deletar tokens antigos do usuário
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Criar novo token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Enviar email com o link de recuperação
    const baseUrl = new URL(request.url).origin;
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    try {
      await sendMail({
        to: user.email,
        subject: "Recuperação de senha - FlixCRD",
        fromEmail: "suporte@pflix.com.br",
        fromName: "Suporte FlixCRD",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Recuperação de senha</h2>
            <p>Olá, ${user.name || "usuário"}!</p>
            <p>Você solicitou a recuperação de senha da sua conta no FlixCRD.</p>
            <p>Clique no botão abaixo para redefinir sua senha:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Redefinir senha
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Ou copie e cole este link no seu navegador:<br>
              <a href="${resetLink}">${resetLink}</a>
            </p>
            <p style="color: #666; font-size: 14px;">
              Este link é válido por 1 hora.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              Se você não solicitou esta recuperação, ignore este email.
            </p>
          </div>
        `,
        text: `
Recuperação de senha - FlixCRD

Olá, ${user.name || "usuário"}!

Você solicitou a recuperação de senha da sua conta no FlixCRD.

Acesse o link abaixo para redefinir sua senha:
${resetLink}

Este link é válido por 1 hora.

Se você não solicitou esta recuperação, ignore este email.
        `,
      });

      console.log(
        `[ForgotPassword] Email de recuperação enviado para ${user.email}`,
      );
    } catch (emailError) {
      console.error("[ForgotPassword] Erro ao enviar email:", emailError);
      // Por segurança, não revelamos que houve erro no envio
    }

    return NextResponse.json({
      success: true,
      message: "Se o email existir, você receberá um link de recuperação.",
    });
  } catch (error: any) {
    console.error("[ForgotPassword] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 },
    );
  }
}

