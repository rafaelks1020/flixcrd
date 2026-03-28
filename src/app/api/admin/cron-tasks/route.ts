import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const tasks = await prisma.cronTask.findMany({
      orderBy: { name: "asc" },
      take: 100,
    });

    return NextResponse.json({ data: tasks });
  } catch (error) {
    console.error("Erro ao listar cron tasks:", error);
    return NextResponse.json(
      { error: "Erro ao listar tarefas de cron" },
      { status: 500 },
    );
  }
}


