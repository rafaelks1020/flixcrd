import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Criar CSV
    const headers = ["ID", "Email", "Nome", "Role", "Criado em", "Atualizado em"];
    const rows = users.map((user) => [
      user.id,
      user.email,
      user.name || "",
      user.role,
      new Date(user.createdAt).toLocaleString("pt-BR"),
      new Date(user.updatedAt).toLocaleString("pt-BR"),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    // Retornar como arquivo CSV
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="usuarios-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Erro ao exportar usuários:", error);
    return NextResponse.json(
      { error: "Erro ao exportar usuários" },
      { status: 500 }
    );
  }
}
