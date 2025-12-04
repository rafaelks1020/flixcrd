import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Tenta fazer uma query simples
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      success: true,
      message: "Conectado e funcionando",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao conectar",
      },
      { status: 500 }
    );
  }
}
