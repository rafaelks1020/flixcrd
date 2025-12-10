const SERVICES_CONFIG = [
  {
    id: "database",
    name: "Banco de Dados",
    path: "/api/status/database",
  },
  {
    id: "storage",
    name: "Storage (Wasabi)",
    path: "/api/status/storage",
  },
  {
    id: "transcoder",
    name: "Transcoder",
    path: "/api/status/transcoder",
  },
  {
    id: "cloudflare",
    name: "Proxy / CDN",
    path: "/api/status/cloudflare",
  },
];

export interface ServiceSnapshot {
  id: string;
  name: string;
  ok: boolean;
  details: string | null;
}

export interface UptimeSummary {
  healthy: number;
  total: number;
  allHealthy: boolean;
  lastCheckAt: string;
}

type StatusBody = {
  success?: boolean;
  error?: string;
  message?: string;
};

async function fetchServiceStatus(service: (typeof SERVICES_CONFIG)[number], baseUrl: string) {
  const serviceUrl = new URL(service.path, baseUrl).toString();

  try {
    const response = await fetch(serviceUrl, { cache: "no-store" });
    let body: StatusBody | null = null;
    try {
      body = (await response.json()) as StatusBody;
    } catch {
      // ignore parse errors, fallback to status
    }

    if (!response.ok) {
      return {
        id: service.id,
        name: service.name,
        ok: false,
        details: body?.error || body?.message || `HTTP ${response.status}`,
      } satisfies ServiceSnapshot;
    }

    const successField = typeof body?.success === "boolean" ? body.success : true;
    return {
      id: service.id,
      name: service.name,
      ok: successField !== false,
      details: body?.message || null,
    } satisfies ServiceSnapshot;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao consultar serviço";
    return {
      id: service.id,
      name: service.name,
      ok: false,
      details: message,
    } satisfies ServiceSnapshot;
  }
}

export async function collectUptimeSnapshot(baseUrl: string) {
  const results = await Promise.allSettled(
    SERVICES_CONFIG.map((service) => fetchServiceStatus(service, baseUrl)),
  );

  const services: ServiceSnapshot[] = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    const message =
      result.reason instanceof Error ? result.reason.message : "Erro desconhecido";
    const fallbackService = SERVICES_CONFIG[index];
    return {
      id: fallbackService?.id ?? "unknown",
      name: fallbackService?.name ?? "Serviço",
      ok: false,
      details: message,
    };
  });

  const total = services.length;
  const healthy = services.filter((service) => service.ok).length;

  const summary: UptimeSummary = {
    healthy,
    total,
    allHealthy: healthy === total && total > 0,
    lastCheckAt: new Date().toISOString(),
  };

  return { summary, services };
}
