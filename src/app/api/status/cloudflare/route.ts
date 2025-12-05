import { NextResponse } from "next/server";

const CLOUDFLARE_URL = process.env.WASABI_CDN_URL || "https://hlspaelflix.top/";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Tenta acessar um arquivo que sabemos que existe (do Wasabi)
    // Usa um arquivo .ts de vídeo que já existe
    const testUrl = `${CLOUDFLARE_URL}titles/a-era-do-gelo/seg_0000.ts`;
    const response = await fetch(testUrl, {
      method: "HEAD",
      signal: controller.signal,
      // Adiciona headers para evitar cache
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);

    // Aceita 200 (OK) ou 403 (Forbidden - significa que o proxy tá funcionando mas precisa de auth)
    if (response.ok || response.status === 403) {
      return NextResponse.json({
        success: true,
        message: response.ok 
          ? "Proxy funcionando (arquivo acessível)" 
          : "Proxy funcionando (arquivo existe mas é privado)",
        url: CLOUDFLARE_URL,
        status: response.status,
      });
    } else if (response.status === 404) {
      // 404 também indica que o proxy tá funcionando, só não achou o arquivo
      return NextResponse.json({
        success: true,
        message: "Proxy funcionando (arquivo de teste não encontrado, mas proxy responde)",
        url: CLOUDFLARE_URL,
        status: response.status,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `HTTP ${response.status}`,
          url: CLOUDFLARE_URL,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.name === "AbortError" ? "Timeout (5s)" : error.message || "Offline",
        url: CLOUDFLARE_URL,
      },
      { status: 500 }
    );
  }
}
