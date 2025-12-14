import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Verificar conexão com o banco, mas sem deixar pendurado por muito tempo.
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Healthcheck timeout")), 1500)),
    ]);

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

export async function HEAD() {
  // HEAD é usado pelo monitor client-side e pode ser chamado com frequência.
  // Não deve bater no banco para evitar custo/latência no Vercel.
  return new NextResponse(null, { status: 200 });
}
