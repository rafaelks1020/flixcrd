/**
 * Cloudflare Cache Manager
 * Gerencia cache de arquivos HLS no Cloudflare CDN
 */

// ========================================
// CONFIGURAÇÕES
// ========================================
const CLOUDFLARE_CONFIG = {
  zoneId: process.env.CLOUDFLARE_ZONE_ID || "88bf779fc8e2b0dff34261c302b0b121",
  apiKey: process.env.CLOUDFLARE_API_KEY || "6983f515cbe2b2233123d5212159ffaba2ecb",
  email: process.env.CLOUDFLARE_EMAIL || "",
  baseUrl: process.env.HLS_BASE_URL || "https://hlspaelflix.top",
};

interface PurgeResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: { id: string };
}

interface CacheWarmResult {
  url: string;
  status: "hit" | "miss" | "dynamic" | "error";
  statusCode?: number;
  error?: string;
}

// ========================================
// PURGE CACHE (LIMPAR)
// ========================================

/**
 * Limpa TODO o cache do site
 */
export async function purgeAllCache(): Promise<PurgeResponse> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_CONFIG.zoneId}/purge_cache`,
    {
      method: "POST",
      headers: {
        "X-Auth-Email": CLOUDFLARE_CONFIG.email,
        "X-Auth-Key": CLOUDFLARE_CONFIG.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ purge_everything: true }),
    }
  );

  return response.json();
}

/**
 * Limpa cache de URLs específicas (máximo 30 por requisição)
 */
export async function purgeUrls(urls: string[]): Promise<PurgeResponse> {
  // Cloudflare limita a 30 URLs por requisição
  if (urls.length > 30) {
    throw new Error("Máximo de 30 URLs por requisição. Use purgeBatch para mais.");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_CONFIG.zoneId}/purge_cache`,
    {
      method: "POST",
      headers: {
        "X-Auth-Email": CLOUDFLARE_CONFIG.email,
        "X-Auth-Key": CLOUDFLARE_CONFIG.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: urls }),
    }
  );

  return response.json();
}

/**
 * Limpa cache de múltiplas URLs em lotes
 */
export async function purgeBatch(urls: string[]): Promise<PurgeResponse[]> {
  const results: PurgeResponse[] = [];
  const batchSize = 30;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const result = await purgeUrls(batch);
    results.push(result);
    
    // Delay entre batches para não exceder rate limit
    if (i + batchSize < urls.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * Limpa cache por prefixo (ex: todos os arquivos de um título)
 */
export async function purgePrefixes(prefixes: string[]): Promise<PurgeResponse> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_CONFIG.zoneId}/purge_cache`,
    {
      method: "POST",
      headers: {
        "X-Auth-Email": CLOUDFLARE_CONFIG.email,
        "X-Auth-Key": CLOUDFLARE_CONFIG.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes }),
    }
  );

  return response.json();
}

// ========================================
// PRÉ-AQUECIMENTO (WARMUP)
// ========================================

/**
 * Pré-aquece uma URL específica
 */
export async function warmUrl(url: string): Promise<CacheWarmResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "FlixCRD-Cache-Warmer/1.0",
      },
    });

    const cacheStatus = response.headers.get("cf-cache-status")?.toLowerCase() || "unknown";

    return {
      url,
      status: cacheStatus as "hit" | "miss" | "dynamic",
      statusCode: response.status,
    };
  } catch (error: any) {
    return {
      url,
      status: "error",
      error: error.message,
    };
  }
}

/**
 * Pré-aquece múltiplas URLs em paralelo
 */
export async function warmUrls(
  urls: string[],
  concurrency: number = 5,
  onProgress?: (completed: number, total: number, result: CacheWarmResult) => void
): Promise<CacheWarmResult[]> {
  const results: CacheWarmResult[] = [];
  let completed = 0;

  // Processar em lotes para controlar concorrência
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(warmUrl));

    for (const result of batchResults) {
      results.push(result);
      completed++;
      onProgress?.(completed, urls.length, result);
    }

    // Pequeno delay entre lotes
    if (i + concurrency < urls.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

// ========================================
// HELPERS PARA HLS
// ========================================

/**
 * Gera URLs de segmentos HLS para um título
 */
export function generateHlsUrls(
  slug: string,
  segmentCount: number = 100,
  type: "title" | "episode" = "title",
  seasonNumber?: number,
  episodeNumber?: number
): string[] {
  const urls: string[] = [];
  let basePath: string;

  if (type === "episode" && seasonNumber && episodeNumber) {
    basePath = `${CLOUDFLARE_CONFIG.baseUrl}/titles/${slug}/s${seasonNumber}e${episodeNumber}`;
  } else {
    basePath = `${CLOUDFLARE_CONFIG.baseUrl}/titles/${slug}`;
  }

  // Playlist
  urls.push(`${basePath}/playlist.m3u8`);

  // Segmentos
  for (let i = 0; i < segmentCount; i++) {
    const segNum = String(i).padStart(4, "0");
    urls.push(`${basePath}/seg_${segNum}.ts`);
  }

  return urls;
}

/**
 * Pré-aquece cache de um título completo
 */
export async function warmTitle(
  slug: string,
  segmentCount: number = 100,
  onProgress?: (completed: number, total: number, result: CacheWarmResult) => void
): Promise<{ success: number; errors: number; results: CacheWarmResult[] }> {
  const urls = generateHlsUrls(slug, segmentCount);
  const results = await warmUrls(urls, 5, onProgress);

  return {
    success: results.filter((r) => r.status !== "error").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}

/**
 * Pré-aquece cache de um episódio
 */
export async function warmEpisode(
  slug: string,
  seasonNumber: number,
  episodeNumber: number,
  segmentCount: number = 100,
  onProgress?: (completed: number, total: number, result: CacheWarmResult) => void
): Promise<{ success: number; errors: number; results: CacheWarmResult[] }> {
  const urls = generateHlsUrls(slug, segmentCount, "episode", seasonNumber, episodeNumber);
  const results = await warmUrls(urls, 5, onProgress);

  return {
    success: results.filter((r) => r.status !== "error").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}

// ========================================
// PURGE + WARMUP COMBINADO
// ========================================

/**
 * Limpa e pré-aquece cache de um título
 */
export async function refreshTitleCache(
  slug: string,
  segmentCount: number = 100,
  onProgress?: (phase: "purge" | "warmup", completed: number, total: number) => void
): Promise<{ purged: boolean; warmed: { success: number; errors: number } }> {
  // 1. Gerar URLs
  const urls = generateHlsUrls(slug, segmentCount);

  // 2. Purge
  onProgress?.("purge", 0, urls.length);
  await purgeBatch(urls);
  onProgress?.("purge", urls.length, urls.length);

  // 3. Aguardar propagação
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 4. Warmup
  let completed = 0;
  const results = await warmUrls(urls, 5, () => {
    completed++;
    onProgress?.("warmup", completed, urls.length);
  });

  return {
    purged: true,
    warmed: {
      success: results.filter((r) => r.status !== "error").length,
      errors: results.filter((r) => r.status === "error").length,
    },
  };
}
