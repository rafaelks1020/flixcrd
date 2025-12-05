#!/usr/bin/env npx ts-node
/**
 * Cache Manager CLI
 * Gerencia cache do Cloudflare via linha de comando
 * 
 * Uso:
 *   npx ts-node scripts/cache-manager.ts warmup monstros-s-a
 *   npx ts-node scripts/cache-manager.ts purge monstros-s-a
 *   npx ts-node scripts/cache-manager.ts refresh monstros-s-a
 *   npx ts-node scripts/cache-manager.ts purge-all
 */

// ========================================
// CONFIGURAÇÕES
// ========================================
const CLOUDFLARE_CONFIG = {
  zoneId: "88bf779fc8e2b0dff34261c302b0b121",
  apiKey: "6983f515cbe2b2233123d5212159ffaba2ecb",
  email: "seu-email@exemplo.com", // Atualize com seu email
  baseUrl: "https://hlspaelflix.top",
};

// ========================================
// FUNÇÕES
// ========================================

async function purgeAll(): Promise<void> {
  console.log("🗑️  Limpando TODO o cache...\n");

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

  const data = await response.json();

  if (data.success) {
    console.log("✅ Cache completo limpo com sucesso!");
  } else {
    console.error("❌ Erro:", data.errors);
  }
}

async function purgeUrls(urls: string[]): Promise<boolean> {
  // Processar em lotes de 30
  for (let i = 0; i < urls.length; i += 30) {
    const batch = urls.slice(i, i + 30);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_CONFIG.zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          "X-Auth-Email": CLOUDFLARE_CONFIG.email,
          "X-Auth-Key": CLOUDFLARE_CONFIG.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files: batch }),
      }
    );

    const data = await response.json();
    if (!data.success) {
      console.error("❌ Erro no lote:", data.errors);
      return false;
    }

    process.stdout.write(`\r🗑️  Purge: ${Math.min(i + 30, urls.length)}/${urls.length}`);
  }

  console.log("\n✅ Purge concluído!");
  return true;
}

async function warmUrl(url: string): Promise<{ url: string; status: string }> {
  try {
    const response = await fetch(url);
    const status = response.headers.get("cf-cache-status") || "unknown";
    return { url, status };
  } catch (error: any) {
    return { url, status: "error" };
  }
}

async function warmUrls(urls: string[]): Promise<void> {
  let completed = 0;
  let hits = 0;
  let misses = 0;
  let errors = 0;

  // Processar em paralelo (5 de cada vez)
  for (let i = 0; i < urls.length; i += 5) {
    const batch = urls.slice(i, i + 5);
    const results = await Promise.all(batch.map(warmUrl));

    for (const result of results) {
      completed++;
      if (result.status === "HIT") hits++;
      else if (result.status === "error") errors++;
      else misses++;

      process.stdout.write(
        `\r🔥 Warmup: ${completed}/${urls.length} | HIT: ${hits} | MISS: ${misses} | ERR: ${errors}`
      );
    }

    // Pequeno delay
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log("\n✅ Warmup concluído!");
}

function generateUrls(slug: string, count: number = 100): string[] {
  const urls: string[] = [];
  const basePath = `${CLOUDFLARE_CONFIG.baseUrl}/b2/titles/${slug}`;

  // Playlist
  urls.push(`${basePath}/playlist.m3u8`);

  // Segmentos
  for (let i = 0; i < count; i++) {
    const segNum = String(i).padStart(4, "0");
    urls.push(`${basePath}/seg_${segNum}.ts`);
  }

  return urls;
}

// ========================================
// COMANDOS
// ========================================

async function warmup(slug: string, count: number = 100): Promise<void> {
  console.log(`\n🔥 Pré-aquecendo cache de: ${slug}\n`);

  const urls = generateUrls(slug, count);
  console.log(`📝 Total de URLs: ${urls.length}\n`);

  await warmUrls(urls);

  console.log("\n" + "═".repeat(50));
  console.log("📊 Cache pré-aquecido com sucesso!");
  console.log("═".repeat(50) + "\n");
}

async function purge(slug: string, count: number = 100): Promise<void> {
  console.log(`\n🗑️  Limpando cache de: ${slug}\n`);

  const urls = generateUrls(slug, count);
  console.log(`📝 Total de URLs: ${urls.length}\n`);

  await purgeUrls(urls);

  console.log("\n" + "═".repeat(50));
  console.log("📊 Cache limpo com sucesso!");
  console.log("═".repeat(50) + "\n");
}

async function refresh(slug: string, count: number = 100): Promise<void> {
  console.log(`\n🔄 Atualizando cache de: ${slug}\n`);

  const urls = generateUrls(slug, count);
  console.log(`📝 Total de URLs: ${urls.length}\n`);

  // 1. Purge
  console.log("📍 Fase 1: Limpando cache...");
  await purgeUrls(urls);

  // 2. Aguardar
  console.log("\n⏳ Aguardando propagação (3s)...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 3. Warmup
  console.log("\n📍 Fase 2: Pré-aquecendo cache...");
  await warmUrls(urls);

  console.log("\n" + "═".repeat(50));
  console.log("📊 Cache atualizado com sucesso!");
  console.log("═".repeat(50) + "\n");
}

async function checkStatus(slug: string): Promise<void> {
  console.log(`\n📊 Verificando status do cache: ${slug}\n`);

  const urls = generateUrls(slug, 10); // Apenas primeiros 10

  for (const url of urls) {
    const result = await warmUrl(url);
    const icon = result.status === "HIT" ? "✅" : result.status === "DYNAMIC" ? "🔄" : "❌";
    const shortUrl = url.split("/").slice(-2).join("/");
    console.log(`${icon} ${result.status.padEnd(8)} ${shortUrl}`);
  }

  console.log("");
}

// ========================================
// MAIN
// ========================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const slug = args[1];
  const count = parseInt(args[2]) || 100;

  console.log("\n" + "═".repeat(50));
  console.log("🚀 FLIXCRD CACHE MANAGER");
  console.log("═".repeat(50));

  switch (command) {
    case "warmup":
      if (!slug) {
        console.error("❌ Uso: cache-manager warmup <slug> [count]");
        process.exit(1);
      }
      await warmup(slug, count);
      break;

    case "purge":
      if (!slug) {
        console.error("❌ Uso: cache-manager purge <slug> [count]");
        process.exit(1);
      }
      await purge(slug, count);
      break;

    case "refresh":
      if (!slug) {
        console.error("❌ Uso: cache-manager refresh <slug> [count]");
        process.exit(1);
      }
      await refresh(slug, count);
      break;

    case "purge-all":
      await purgeAll();
      break;

    case "status":
      if (!slug) {
        console.error("❌ Uso: cache-manager status <slug>");
        process.exit(1);
      }
      await checkStatus(slug);
      break;

    default:
      console.log(`
📖 Comandos disponíveis:

  warmup <slug> [count]   Pré-aquece cache de um título
  purge <slug> [count]    Limpa cache de um título
  refresh <slug> [count]  Limpa e pré-aquece (purge + warmup)
  purge-all               Limpa TODO o cache do site
  status <slug>           Verifica status do cache

📝 Exemplos:

  npx ts-node scripts/cache-manager.ts warmup monstros-s-a
  npx ts-node scripts/cache-manager.ts warmup monstros-s-a 200
  npx ts-node scripts/cache-manager.ts purge toy-story
  npx ts-node scripts/cache-manager.ts refresh monstros-s-a
  npx ts-node scripts/cache-manager.ts status monstros-s-a
  npx ts-node scripts/cache-manager.ts purge-all
`);
  }
}

main().catch(console.error);
