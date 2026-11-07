import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { adminDenied } from "@/lib/require-admin";

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;

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


