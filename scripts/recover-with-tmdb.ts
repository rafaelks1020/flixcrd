/**
 * Script de recuperação avançado: Escaneia o bucket Wasabi, busca metadados no TMDB
 * e cria títulos completos no banco.
 * 
 * Uso: npx ts-node scripts/recover-with-tmdb.ts
 */

import { PrismaClient } from "@prisma/client";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const wasabiClient = new S3Client({
  endpoint: process.env.WASABI_ENDPOINT || "https://s3.us-east-1.wasabisys.com",
  region: process.env.WASABI_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY || "",
  },
});

const bucketName = process.env.WASABI_BUCKET_NAME || "";
const tmdbApiKey = process.env.TMDB_API_KEY || "";

interface TitleInfo {
  path: string;
  name: string;
  hasHls: boolean;
  hasVideo: boolean;
  type: "MOVIE" | "SERIES" | "ANIME";
}

async function searchTMDB(name: string, type: "MOVIE" | "SERIES" | "ANIME") {
  const cleanName = name
    .replace(/\d{4}$/, "") // Remove ano no final
    .replace(/\b(dublado|legendado|hd|bluray|brrip|webrip)\b/gi, "")
    .trim();

  const mediaType = type === "MOVIE" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${tmdbApiKey}&query=${encodeURIComponent(cleanName)}&language=pt-BR`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0]; // Pegar o primeiro resultado
    }
  } catch (error) {
    console.error(`   ❌ Erro ao buscar "${cleanName}" no TMDB:`, error);
  }

  return null;
}

async function getTMDBDetails(tmdbId: number, type: "MOVIE" | "SERIES" | "ANIME") {
  const mediaType = type === "MOVIE" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${tmdbApiKey}&language=pt-BR&append_to_response=credits,videos`;

  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error(`   ❌ Erro ao buscar detalhes do TMDB ID ${tmdbId}:`, error);
    return null;
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function scanBucket(): Promise<TitleInfo[]> {
  console.log("🔍 Escaneando bucket Wasabi...");
  
  let allContents: any[] = [];
  let continuationToken: string | undefined = undefined;
  let pageCount = 0;

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

  const titleMap = new Map<string, { files: string[]; path: string }>();

  for (const obj of allContents) {
    const key = obj.Key || "";
    if (!key.includes("/")) continue;

    const parts = key.split("/");
    let titlePath: string;
    
    if (parts[0].toLowerCase() === "titles" && parts.length > 1) {
      titlePath = `${parts[0]}/${parts[1]}`;
    } else {
      titlePath = parts[0];
    }

    if (!titleMap.has(titlePath)) {
      titleMap.set(titlePath, { files: [], path: titlePath });
    }

    titleMap.get(titlePath)!.files.push(key);
  }

  console.log(`📁 Encontrados ${titleMap.size} diretórios de títulos`);

  const titles: TitleInfo[] = [];

  for (const [titlePath, data] of titleMap.entries()) {
    const hasHls = data.files.some(f => f.toLowerCase().endsWith(".m3u8"));
    const hasVideo = data.files.some(f => 
      /\.(mp4|mkv|avi|mov|webm|m4v)$/i.test(f)
    );

    if (!hasHls && !hasVideo) continue;

    let type: "MOVIE" | "SERIES" | "ANIME" = "MOVIE";
    const lowerPath = titlePath.toLowerCase();
    
    if (lowerPath.includes("anime") || lowerPath.includes("one-piece") || lowerPath.includes("naruto")) {
      type = "ANIME";
    } else if (lowerPath.includes("serie") || lowerPath.includes("season") || lowerPath.includes("temporada")) {
      type = "SERIES";
    }

    let name = titlePath
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

async function recoverWithTMDB(titles: TitleInfo[]) {
  console.log(`\n🔄 Recuperando ${titles.length} títulos com metadados do TMDB...\n`);

  let created = 0;
  let skipped = 0;
  let notFound = 0;

  for (const titleInfo of titles) {
    try {
      console.log(`📺 ${titleInfo.name}`);

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
        console.log(`   ⏭️  Já existe no banco\n`);
        skipped++;
        continue;
      }

      // Buscar no TMDB
      console.log(`   🔍 Buscando no TMDB...`);
      const searchResult = await searchTMDB(titleInfo.name, titleInfo.type);

      if (!searchResult) {
        console.log(`   ⚠️  Não encontrado no TMDB, criando sem metadados\n`);
        notFound++;
        
        await prisma.title.create({
          data: {
            name: titleInfo.name,
            slug: slugify(titleInfo.name),
            type: titleInfo.type,
            hlsPath: titleInfo.path,
            overview: `Título recuperado automaticamente. ${titleInfo.hasHls ? "HLS disponível." : "Aguardando transcodificação."}`,
          },
        });
        
        created++;
        continue;
      }

      // Buscar detalhes completos
      const tmdbId = searchResult.id;
      console.log(`   ✅ Encontrado: ${searchResult.title || searchResult.name} (TMDB ID: ${tmdbId})`);
      
      const details = await getTMDBDetails(tmdbId, titleInfo.type);
      
      if (!details) {
        console.log(`   ⚠️  Erro ao buscar detalhes, criando sem metadados\n`);
        notFound++;
        continue;
      }

      // Criar título com todos os metadados
      const slug = slugify(details.title || details.name || titleInfo.name);
      
      await prisma.title.create({
        data: {
          tmdbId: tmdbId,
          type: titleInfo.type,
          slug: slug,
          name: details.title || details.name || titleInfo.name,
          originalName: details.original_title || details.original_name || null,
          overview: details.overview || null,
          tagline: details.tagline || null,
          releaseDate: details.release_date || details.first_air_date
            ? new Date(details.release_date || details.first_air_date)
            : null,
          posterUrl: details.poster_path
            ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
            : null,
          backdropUrl: details.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
            : null,
          logoUrl: null,
          runtime: details.runtime || details.episode_run_time?.[0] || null,
          voteAverage: details.vote_average || null,
          voteCount: details.vote_count || null,
          popularity: details.popularity || null,
          status: details.status || null,
          originalLanguage: details.original_language || null,
          spokenLanguages: details.spoken_languages
            ? JSON.stringify(details.spoken_languages)
            : null,
          productionCountries: details.production_countries
            ? JSON.stringify(details.production_countries)
            : null,
          hlsPath: titleInfo.path,
        },
      });

      console.log(`   💾 Salvo com metadados completos\n`);
      created++;

      // Delay para não sobrecarregar a API do TMDB
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error: any) {
      console.error(`   ❌ Erro ao processar: ${error.message}\n`);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Criados com TMDB: ${created - notFound}`);
  console.log(`   ⚠️  Criados sem TMDB: ${notFound}`);
  console.log(`   ⏭️  Ignorados (já existem): ${skipped}`);
  console.log(`   📁 Total escaneado: ${titles.length}`);
}

async function main() {
  console.log("🚀 Iniciando recuperação avançada com TMDB...\n");

  if (!bucketName) {
    console.error("❌ WASABI_BUCKET_NAME não configurado no .env");
    process.exit(1);
  }

  if (!tmdbApiKey) {
    console.error("❌ TMDB_API_KEY não configurado no .env");
    process.exit(1);
  }

  try {
    const titles = await scanBucket();
    
    if (titles.length === 0) {
      console.log("⚠️  Nenhum título encontrado para recuperar");
      return;
    }

    await recoverWithTMDB(titles);

    console.log("\n✨ Recuperação concluída!");
  } catch (error) {
    console.error("❌ Erro durante recuperação:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
