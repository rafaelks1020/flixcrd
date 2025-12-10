import { NextRequest, NextResponse } from "next/server";

import type { CronTask } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CronTaskRecord = {
  name: string;
  description?: string;
  endpoint: string;
  method?: string;
  intervalMinutes: number;
};

const DISPATCH_SECRET = process.env.CRON_DISPATCH_SECRET;
const UPTIME_CRON_SECRET = process.env.UPTIME_CRON_SECRET;

const DEFAULT_TASKS: CronTaskRecord[] = [
  {
    name: "uptime-hourly",
    description: "Registra snapshot de uptime de hora em hora",
    endpoint: "/api/admin/uptime/record",
    method: "GET",
    intervalMinutes: 60,
  },
];

function isAuthorized(request: NextRequest) {
  if (!DISPATCH_SECRET) return true;

  const headerSecret =
    request.headers.get("x-cron-secret") ??
    request.nextUrl.searchParams.get("secret");

  return headerSecret === DISPATCH_SECRET;
}

function resolveUrl(endpoint: string, baseUrl: string) {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  return new URL(endpoint, baseUrl).toString();
}

async function ensureDefaultTasks() {
  await Promise.all(
    DEFAULT_TASKS.map((task) =>
      prisma.cronTask.upsert({
        where: { name: task.name },
        update: {
          endpoint: task.endpoint,
          intervalMinutes: task.intervalMinutes,
          method: task.method ?? "GET",
          description: task.description,
          enabled: true,
        },
        create: {
          name: task.name,
          endpoint: task.endpoint,
          intervalMinutes: task.intervalMinutes,
          method: task.method ?? "GET",
          description: task.description,
          enabled: true,
        },
      }),
    ),
  );
}

function shouldRun(task: Pick<CronTask, "enabled" | "lastRunAt" | "intervalMinutes">) {
  if (!task.enabled) return false;
  if (!task.lastRunAt) return true;

  const diffMs = Date.now() - task.lastRunAt.getTime();
  return diffMs >= task.intervalMinutes * 60 * 1000;
}

async function runTask(task: CronTask, baseUrl: string) {
  const url = resolveUrl(task.endpoint, baseUrl);
  const startedAt = Date.now();
  let lastStatus: number | null = null;
  let lastError: string | null = null;
  let ok = false;

  try {
    const res = await fetch(url, {
      method: task.method || "GET",
      headers: {
        ...(UPTIME_CRON_SECRET ? { "x-cron-secret": UPTIME_CRON_SECRET } : {}),
      },
    });

    lastStatus = res.status;
    ok = res.ok;

    const bodyText = await res.text().catch(() => "");
    if (!res.ok) {
      lastError = bodyText?.slice(0, 500) || `HTTP ${res.status}`;
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Erro desconhecido ao executar tarefa";
  }

  const durationMs = Date.now() - startedAt;
  const now = new Date();

  await prisma.cronTask.update({
    where: { id: task.id },
    data: {
      lastRunAt: now,
      lastStatus,
      lastDurationMs: durationMs,
      lastError: ok ? null : lastError,
      lastSuccessAt: ok ? now : task.lastSuccessAt,
    },
  });

  return {
    name: task.name,
    endpoint: task.endpoint,
    ok,
    status: lastStatus,
    durationMs,
    error: ok ? undefined : lastError,
  };
}

async function handler(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;

  await ensureDefaultTasks();

  const tasks = await prisma.cronTask.findMany({
    where: { enabled: true },
    orderBy: { name: "asc" },
  });

  const dueTasks = tasks.filter(shouldRun);

  const results = await Promise.allSettled(
    dueTasks.map((task) => runTask(task, baseUrl)),
  );

  const executed = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    const task = dueTasks[index];
    const error =
      result.reason instanceof Error
        ? result.reason.message
        : "Erro desconhecido ao executar tarefa";

    return {
      name: task?.name ?? "unknown",
      endpoint: task?.endpoint ?? "unknown",
      ok: false,
      error,
    };
  });

  return NextResponse.json({
    now: new Date().toISOString(),
    totalTasks: tasks.length,
    executedCount: dueTasks.length,
    skipped: tasks.length - dueTasks.length,
    results: executed,
  });
}

export async function POST(request: NextRequest) {
  return handler(request);
}

export async function GET(request: NextRequest) {
  return handler(request);
}

