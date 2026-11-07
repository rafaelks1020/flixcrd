import { NextRequest, NextResponse } from "next/server";
import { collectUptimeSnapshot } from "@/lib/uptime-monitor";
import { prisma } from "@/lib/prisma";
import { cronRequestAuthorized } from "@/lib/safe-equal";

function isAuthorized(request: NextRequest) {
  // Aceita x-cron-secret (agendador próprio) ou Authorization: Bearer (Vercel Cron usa CRON_SECRET)
  return cronRequestAuthorized(request, [process.env.UPTIME_CRON_SECRET, process.env.CRON_SECRET]);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = new URL(request.url).origin;
    const { summary, services } = await collectUptimeSnapshot(baseUrl);

    const snapshot = await prisma.serviceStatusSnapshot.create({
      data: {
        healthy: summary.healthy,
        total: summary.total,
        allHealthy: summary.allHealthy,
        services: services as unknown as Parameters<typeof prisma.serviceStatusSnapshot.create>[0]["data"]["services"],
      },
    });

    return NextResponse.json({
      success: true,
      snapshotId: snapshot.id,
      summary,
      services,
    });
  } catch (error) {
    console.error("Erro ao registrar snapshot de uptime:", error);
    return NextResponse.json(
      { error: "Erro ao registrar snapshot de uptime" },
      { status: 500 },
    );
  }
}
