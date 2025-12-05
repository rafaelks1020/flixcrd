import { NextResponse } from "next/server";

// Simulação de dados de uptime (últimas 24 horas)
// Em produção, isso viria de um sistema de monitoramento real
export async function GET() {
  try {
    const now = new Date();
    const uptime = Array.from({ length: 24 }, (_, i) => {
      const timestamp = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      
      // Simular 99% de uptime (apenas 1% de downtime aleatório)
      const isUp = Math.random() > 0.01;
      
      return {
        timestamp: timestamp.toISOString(),
        status: isUp ? "up" : "down",
      };
    });

    return NextResponse.json({ uptime });
  } catch (error) {
    console.error("Erro ao buscar uptime:", error);
    return NextResponse.json(
      { error: "Erro ao buscar dados de uptime" },
      { status: 500 }
    );
  }
}
