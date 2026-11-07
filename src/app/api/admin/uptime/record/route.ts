import { NextRequest, NextResponse } from "next/server";
import { collectUptimeSnapshot } from "@/lib/uptime-monitor";
import { prisma } from "@/lib/prisma";
import { secretsMatch } from "@/lib/safe-equal";

function isAuthorized(request: NextRequest) {
  const secret = process.env.UPTIME_CRON_SECRET;
  if (!secret) return false;
  const headerSecret = request.headers.get("x-cron-secret");
  if (!headerSecret) return false;
  return secretsMatch(headerSecret, secret);
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
