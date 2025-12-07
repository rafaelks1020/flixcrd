/**
 * Serviço para gerar tokens de streaming protegidos via Cloudflare Worker
 * 
 * Fluxo:
 * 1. Backend chama Worker com contentId + storage
 * 2. Worker gera token JWT assinado + URL ofuscada
 * 3. Frontend usa URL protegida para streaming
 */

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;
const API_SECRET_KEY = process.env.CLOUDFLARE_WORKER_SECRET;

export interface StreamTokenResponse {
  token: string;
  streamUrl: string;
  expiresAt: number;
}

/**
 * Gera URL de streaming protegida para um conteúdo
 * 
 * @param contentId - Caminho do conteúdo no storage (ex: "titles/nome-do-filme" ou "episodes/xxx")
 * @param storage - Tipo de storage: "b2" ou "wasabi"
 * @returns URL de streaming protegida com token JWT
 */
export async function generateStreamToken(
  contentId: string,
  storage: "b2" | "wasabi" = "wasabi"
): Promise<StreamTokenResponse | null> {
  if (!WORKER_URL || !API_SECRET_KEY) {
    console.error("[stream-token] CLOUDFLARE_WORKER_URL ou CLOUDFLARE_WORKER_SECRET não configurados");
    return null;
  }

  try {
    const response = await fetch(`${WORKER_URL}/api/generate-token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentId,
        storage,
      }),
    });

    if (!response.ok) {
      console.error("[stream-token] Erro ao gerar token:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    return {
      token: data.token,
      streamUrl: `${WORKER_URL}${data.streamUrl}`,
      expiresAt: data.expiresAt,
    };
  } catch (error) {
    console.error("[stream-token] Erro ao chamar Worker:", error);
    return null;
  }
}

/**
 * Verifica se o sistema de streaming protegido está configurado
 */
export function isProtectedStreamingEnabled(): boolean {
  return Boolean(WORKER_URL && API_SECRET_KEY);
}

/**
 * Retorna a URL base do Worker (para o frontend renovar tokens)
 */
export function getWorkerUrl(): string | null {
  return WORKER_URL || null;
}
