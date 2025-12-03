/**
 * Script para atualizar títulos existentes com metadados do TMDB
 * 
 * Uso: npx ts-node scripts/update-tmdb-metadata.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const tmdbApiKey = process.env.TMDB_API_KEY || "";

async function searchTMDB(name: string, type: string) {
  const cleanName = name
    .replace(/\d{4}$/, "")
    .replace(/\b(dublado|legendado|hd|bluray|brrip|webrip)\b/gi, "")
    .trim();

  const mediaType = type === "MOVIE" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${tmdbApiKey}&query=${encodeURIComponent(cleanName)}&language=pt-BR`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0];
    }
  } catch (error) {
    console.error(`   ❌ Erro ao buscar "${cleanName}":`, error);
  }

  return null;
}

async function getTMDBDetails(tmdbId: number, type: string) {
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

async function updateTitles() {
  console.log("🔄 Buscando títulos sem metadados do TMDB...\n");

  const titles = await prisma.title.findMany({
    where: {
      OR: [
        { tmdbId: null },
        { posterUrl: null },
        { overview: null },
      ],
    },
    orderBy: { name: "asc" },
  });

  console.log(`📋 Encontrados ${titles.length} títulos para atualizar\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const title of titles) {
    try {
      console.log(`📺 ${title.name}`);

      // Se já tem tmdbId, buscar detalhes direto
      let tmdbId = title.tmdbId;
      let searchResult = null;

      if (!tmdbId) {
        console.log(`   🔍 Buscando no TMDB...`);
        searchResult = await searchTMDB(title.name, title.type);

        if (!searchResult) {
          console.log(`   ⚠️  Não encontrado no TMDB\n`);
          notFound++;
          continue;
        }

        tmdbId = searchResult.id;
        console.log(`   ✅ Encontrado: ${searchResult.title || searchResult.name} (TMDB ID: ${tmdbId})`);
      }

      // Buscar detalhes completos
      if (!tmdbId) {
        console.log(`   ❌ TMDB ID inválido\n`);
        errors++;
        continue;
      }
      
      const details = await getTMDBDetails(tmdbId, title.type);

      if (!details) {
        console.log(`   ❌ Erro ao buscar detalhes\n`);
        errors++;
        continue;
      }

      // Atualizar título
      await prisma.title.update({
        where: { id: title.id },
        data: {
          tmdbId: tmdbId,
          name: details.title || details.name || title.name,
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
        },
      });

      console.log(`   💾 Atualizado com sucesso\n`);
      updated++;

      // Delay para não sobrecarregar a API do TMDB
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error: any) {
      console.error(`   ❌ Erro ao processar: ${error.message}\n`);
      errors++;
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Atualizados: ${updated}`);
  console.log(`   ⚠️  Não encontrados no TMDB: ${notFound}`);
  console.log(`   ❌ Erros: ${errors}`);
  console.log(`   📁 Total processado: ${titles.length}`);
}

async function main() {
  console.log("🚀 Iniciando atualização de metadados do TMDB...\n");

  if (!tmdbApiKey) {
    console.error("❌ TMDB_API_KEY não configurado no .env");
    process.exit(1);
  }

  try {
    await updateTitles();
    console.log("\n✨ Atualização concluída!");
  } catch (error) {
    console.error("❌ Erro durante atualização:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
