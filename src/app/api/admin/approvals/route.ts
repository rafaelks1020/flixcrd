import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailjet";

// GET - Lista usuários pendentes de aprovação
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";

    const usersRaw = await prisma.user.findMany({
      where: {
        approvalStatus: status as any,
        role: "USER", // Não listar admins
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        cpfCnpj: true,
        approvalStatus: true,
        approvedAt: true,
        approvedBy: true,
        rejectionReason: true,
        createdAt: true,
        Subscription: {
          select: {
            status: true,
            plan: true,
          },
        },
      },
    });

    const users = usersRaw.map((u: any) => {
      const { Subscription, ...rest } = u;
      return {
        ...rest,
        subscription: Subscription ?? null,
      };
    });

    // Contar por status
    const counts = await prisma.user.groupBy({
      by: ["approvalStatus"],
      where: { role: "USER" },
      _count: {
        _all: true,
      },
    });

    const stats = {
      pending: counts.find((c) => c.approvalStatus === "PENDING")?._count?._all || 0,
      approved: counts.find((c) => c.approvalStatus === "APPROVED")?._count?._all || 0,
      rejected: counts.find((c) => c.approvalStatus === "REJECTED")?._count?._all || 0,
    };

    return NextResponse.json({ users, stats });
  } catch (error) {
    console.error("Error fetching approvals:", error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Erro ao carregar aprovações";

    return NextResponse.json(
      { error: message || "Erro ao carregar aprovações" },
      { status: 500 }
    );
  }
}

// POST - Aprovar ou rejeitar usuário
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, action, rejectionReason } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: "userId e action são obrigatórios" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "action deve ser 'approve' ou 'reject'" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    if (action === "approve") {
      await prisma.user.update({
        where: { id: userId },
        data: {
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          approvedBy: (session.user as any).id,
          rejectionReason: null,
        },
      });
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
        await sendMail({
          to: user.email,
          subject: "Cadastro aprovado - FlixCRD",
          fromEmail: "suporte@pflix.com.br",
          fromName: "Suporte FlixCRD",
          meta: {
            reason: "user-approved",
            userId: user.id,
          },
          context: {
            approvalStatus: "APPROVED",
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Cadastro aprovado</h2>
              <p>Olá, ${user.name || user.email}!</p>
              <p>Seu cadastro no <strong>FlixCRD</strong> foi aprovado.</p>
              <p>Agora você já pode acessar a plataforma e gerenciar sua assinatura.</p>
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
Cadastro aprovado - FlixCRD

Olá, ${user.name || user.email}!

Seu cadastro no FlixCRD foi aprovado.
Agora você já pode acessar a plataforma e gerenciar sua assinatura.

Acesse: ${appUrl}

Se você não reconhece este cadastro, entre em contato com o suporte.
          `,
        });
      } catch (emailError) {
        console.error("[Approvals] Erro ao enviar email de aprovação:", emailError);
      }

      return NextResponse.json({
        success: true,
        message: `Usuário ${user.email} aprovado com sucesso!`,
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          approvalStatus: "REJECTED",
          rejectionReason: rejectionReason || "Cadastro não aprovado",
        },
      });
      try {
        await sendMail({
          to: user.email,
          subject: "Cadastro não aprovado - FlixCRD",
          fromEmail: "suporte@pflix.com.br",
          fromName: "Suporte FlixCRD",
          meta: {
            reason: "user-rejected",
            userId: user.id,
          },
          context: {
            approvalStatus: "REJECTED",
            rejectionReason: rejectionReason || "Cadastro não aprovado",
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e50914;">Cadastro não aprovado</h2>
              <p>Olá, ${user.name || user.email}.</p>
              <p>Seu cadastro no <strong>FlixCRD</strong> não foi aprovado neste momento.</p>
              <p>${rejectionReason || "Cadastro não aprovado"}</p>
              <p style="color: #666; font-size: 14px;">
                Em caso de dúvidas, responda este email ou entre em contato com o suporte.
              </p>
            </div>
          `,
          text: `
Cadastro não aprovado - FlixCRD

Olá, ${user.name || user.email}.

Seu cadastro no FlixCRD não foi aprovado neste momento.

Motivo: ${rejectionReason || "Cadastro não aprovado"}

Em caso de dúvidas, responda este email ou entre em contato com o suporte.
          `,
        });
      } catch (emailError) {
        console.error("[Approvals] Erro ao enviar email de rejeição:", emailError);
      }

      return NextResponse.json({
        success: true,
        message: `Usuário ${user.email} rejeitado.`,
      });
    }
  } catch (error) {
    console.error("Error processing approval:", error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Erro ao processar aprovação";

    return NextResponse.json(
      { error: message || "Erro ao processar aprovação" },
      { status: 500 }
    );
  }
}
