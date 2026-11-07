import { NextRequest, NextResponse } from "next/server";
import { collectUptimeSnapshot } from "@/lib/uptime-monitor";
import { adminDenied } from "@/lib/require-admin";

export async function GET(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;

  try {
    const baseUrl = new URL(request.url).origin;
    const { summary, services } = await collectUptimeSnapshot(baseUrl);
    return NextResponse.json({ summary, services });
  } catch (error) {
    console.error("Erro ao buscar uptime:", error);
    return NextResponse.json(
      { error: "Erro ao buscar dados de uptime" },
      { status: 500 },
    );
  }
}
