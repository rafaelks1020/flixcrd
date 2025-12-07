import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH - Atualiza status de um token
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { tokenId, isActive } = body;

    if (!tokenId) {
      return NextResponse.json(
        { error: "ID do token é obrigatório" },
        { status: 400 }
      );
    }

    await prisma.pushToken.update({
      where: { id: tokenId },
      data: { isActive },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating token:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar token" },
      { status: 500 }
    );
  }
}

// DELETE - Remove um token
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get("id");

    if (!tokenId) {
      return NextResponse.json(
        { error: "ID do token é obrigatório" },
        { status: 400 }
      );
    }

    await prisma.pushToken.delete({
      where: { id: tokenId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting token:", error);
    return NextResponse.json(
      { error: "Erro ao excluir token" },
      { status: 500 }
    );
  }
}
