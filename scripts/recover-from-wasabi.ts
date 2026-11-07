import { storageEnv } from "../src/lib/storage-config";
/**
 * Script de recuperação: Escaneia o bucket Wasabi e recria títulos no banco
 * baseado nos arquivos de vídeo encontrados.
 * 
 * Uso: npx ts-node scripts/recover-from-wasabi.ts
 */

import { PrismaClient } from "@prisma/client";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const wasabiClient = new S3Client({
  endpoint: storageEnv.endpoint || "https://s3.us-east-1.wasabisys.com",
  region: storageEnv.region || "us-east-1",
  credentials: {
    accessKeyId: storageEnv.accessKeyId || "",
    secretAccessKey: storageEnv.secretAccessKey || "",
  },
});

const bucketName = storageEnv.bucket || "";

interface TitleInfo {
  path: string;
  name: string;
  hasHls: boolean;
  hasVideo: boolean;
  type: "MOVIE" | "SERIES" | "ANIME";
}

async function scanBucket(): Promise<TitleInfo[]> {
  console.log("🔍 Escaneando bucket Wasabi...");
  
  let allContents: any[] = [];
  let continuationToken: string | undefined = undefined;
  let pageCount = 0;

  // Paginar através de todos os objetos
  do {
    pageCount++;
    console.log(`   Página ${pageCount}...`);
    
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    });

    const response: any = await wasabiClient.send(command);
    
    if (response.Contents) {
      allContents = allContents.concat(response.Contents);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  if (allContents.length === 0) {
    console.log("⚠️  Nenhum arquivo encontrado no bucket");
    return [];
  }

  console.log(`📦 Encontrados ${allContents.length} arquivos no bucket (${pageCount} páginas)`);

  // Agrupar arquivos por diretório (título)
  const titleMap = new Map<string, { files: string[]; path: string }>();

  for (const obj of allContents) {
    const key = obj.Key || "";
    
    // Ignorar arquivos na raiz
    if (!key.includes("/")) continue;

    const parts = key.split("/");
    
    // Se começar com "titles/", pegar o segundo nível
    let titlePath: string;
    if (parts[0].toLowerCase() === "titles" && parts.length > 1) {
      titlePath = `${parts[0]}/${parts[1]}`;
    } else {
      // Caso contrário, pegar o primeiro nível
      titlePath = parts[0];
    }

    if (!titleMap.has(titlePath)) {
      titleMap.set(titlePath, { files: [], path: titlePath });
    }

    titleMap.get(titlePath)!.files.push(key);
  }

  console.log(`📁 Encontrados ${titleMap.size} diretórios de títulos`);

  // Analisar cada título
  const titles: TitleInfo[] = [];

  for (const [titlePath, data] of titleMap.entries()) {
    const hasHls = data.files.some(f => f.toLowerCase().endsWith(".m3u8"));
    const hasVideo = data.files.some(f => 
      /\.(mp4|mkv|avi|mov|webm|m4v)$/i.test(f)
    );

    if (!hasHls && !hasVideo) {
      console.log(`⏭️  Ignorando ${titlePath} (sem vídeo ou HLS)`);
      continue;
    }

    // Tentar detectar o tipo baseado no nome
    let type: "MOVIE" | "SERIES" | "ANIME" = "MOVIE";
    const lowerPath = titlePath.toLowerCase();
    
    if (lowerPath.includes("anime") || lowerPath.includes("one-piece") || lowerPath.includes("naruto")) {
      type = "ANIME";
    } else if (lowerPath.includes("serie") || lowerPath.includes("season") || lowerPath.includes("temporada")) {
      type = "SERIES";
    }

    // Limpar o nome do título
    const name = titlePath
      .replace(/^titles\//i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    titles.push({
      path: titlePath,
      name,
      hasHls,
      hasVideo,
      type,
    });
  }

  return titles;
}

async function recoverTitles(titles: TitleInfo[]) {
  console.log(`\n🔄 Recuperando ${titles.length} títulos no banco...`);

  let created = 0;
  let skipped = 0;

  for (const titleInfo of titles) {
    try {
      // Verificar se já existe
      const existing = await prisma.title.findFirst({
        where: {
          OR: [
            { name: titleInfo.name },
            { hlsPath: titleInfo.path },
          ],
        },
      });

      if (existing) {
        console.log(`⏭️  ${titleInfo.name} já existe no banco`);
        skipped++;
        continue;
      }

      // Criar slug
      const slug = titleInfo.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Criar título
      await prisma.title.create({
        data: {
          name: titleInfo.name,
          slug,
          type: titleInfo.type,
          hlsPath: titleInfo.path,
          overview: `Título recuperado automaticamente do bucket Wasabi. ${titleInfo.hasHls ? "HLS disponível." : "Apenas vídeo bruto disponível."}`,
          status: titleInfo.hasHls ? "Released" : "Post Production",
        },
      });

      console.log(`✅ ${titleInfo.name} (${titleInfo.type}) - ${titleInfo.hasHls ? "HLS" : "Vídeo"}`);
      created++;
    } catch (error: any) {
      console.error(`❌ Erro ao criar ${titleInfo.name}:`, error.message);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Criados: ${created}`);
  console.log(`   ⏭️  Ignorados (já existem): ${skipped}`);
  console.log(`   📁 Total escaneado: ${titles.length}`);
}

async function main() {
  console.log("🚀 Iniciando recuperação de títulos do Wasabi...\n");

  if (!bucketName) {
    console.error("❌ WASABI_BUCKET_NAME não configurado no .env");
    process.exit(1);
  }

  try {
    const titles = await scanBucket();
    
    if (titles.length === 0) {
      console.log("⚠️  Nenhum título encontrado para recuperar");
      return;
    }

    console.log(`\n📋 Títulos encontrados:`);
    titles.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name} (${t.type}) - ${t.hasHls ? "HLS" : "Vídeo"}`);
    });

    console.log("\n");
    await recoverTitles(titles);

    console.log("\n✨ Recuperação concluída!");
  } catch (error) {
    console.error("❌ Erro durante recuperação:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
