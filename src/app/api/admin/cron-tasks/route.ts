import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tasks = await prisma.cronTask.findMany({
      orderBy: { name: "asc" },
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

