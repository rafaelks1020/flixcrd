import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  const startTime = Date.now()
  
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Healthcheck timeout")), 1500)),
    ]);

    const duration = Date.now() - startTime
    logger.info('Health check successful', { 
      duration, 
      database: 'connected' 
    })

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Health check failed', error as Error, { 
      duration,
      database: 'disconnected' 
    })

    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        duration: `${duration}ms`
      },
      { status: 503 }
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
