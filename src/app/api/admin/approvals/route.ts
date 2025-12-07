import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Lista usuários pendentes de aprovação
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";

    const users = await prisma.user.findMany({
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
        subscription: {
          select: {
            status: true,
            plan: true,
          },
        },
      },
    });

    // Contar por status
    const counts = await prisma.user.groupBy({
      by: ["approvalStatus"],
      where: { role: "USER" },
      _count: true,
    });

    const stats = {
      pending: counts.find((c) => c.approvalStatus === "PENDING")?._count || 0,
      approved: counts.find((c) => c.approvalStatus === "APPROVED")?._count || 0,
      rejected: counts.find((c) => c.approvalStatus === "REJECTED")?._count || 0,
    };

    return NextResponse.json({ users, stats });
  } catch (error) {
    console.error("Error fetching approvals:", error);
    return NextResponse.json(
      { error: "Erro ao carregar aprovações" },
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

      return NextResponse.json({
        success: true,
        message: `Usuário ${user.email} rejeitado.`,
      });
    }
  } catch (error) {
    console.error("Error processing approval:", error);
    return NextResponse.json(
      { error: "Erro ao processar aprovação" },
      { status: 500 }
    );
  }
}
