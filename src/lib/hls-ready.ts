import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { storageEnv } from "@/lib/storage-config";
import { wasabiClient } from "@/lib/wasabi";

/**
 * "Pronto" = o master.m3u8 existe no storage. O conversor sobe o master por último,
 * então se ele existe, todas as variantes e segmentos já estão lá.
 * O catálogo público só mostra títulos com hlsReady; séries aparecem com pelo menos
 * um episódio pronto e só listam os episódios prontos.
 */

const CHECK_CONCURRENCY = 16;

function normalizePrefix(p: string): string {
  const t = p.trim().replace(/^\/+/, "");
  return t.endsWith("/") ? t : `${t}/`;
}

async function masterExists(prefix: string): Promise<boolean> {
  const bucket = storageEnv.bucket;
  if (!bucket) return false;
  try {
    await wasabiClient.send(
      new HeadObjectCommand({ Bucket: bucket, Key: `${normalizePrefix(prefix)}master.m3u8` }),
    );
    return true;
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404) return false;
    // Erro de rede: não muda o estado (lança para o chamador manter o valor atual).
    throw err;
  }
}

// Abaixo disso o vídeo está quebrado (em 08/11 um episódio virou 6 s por conversão errada).
const MIN_PLAYABLE_SECONDS = 30;

async function readText(key: string): Promise<string | null> {
  const bucket = storageEnv.bucket;
  if (!bucket) return null;
  try {
    const res = await wasabiClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return res.Body ? await res.Body.transformToString("utf-8") : null;
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/**
 * Conferência completa: master existe, cada variante existe, termina com ENDLIST
 * e tem duração de vídeo de verdade.
 */
async function isPlayable(prefix: string): Promise<boolean> {
  const base = normalizePrefix(prefix);
  const master = await readText(`${base}master.m3u8`);
  if (!master) return false;
  const variants = master
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.toLowerCase().endsWith(".m3u8"));
  if (variants.length === 0) return false;
  for (const v of variants) {
    const text = await readText(`${base}${v}`);
    if (!text || !text.includes("#EXT-X-ENDLIST")) return false;
    const seconds = Array.from(text.matchAll(/#EXTINF:([\d.]+)/g)).reduce((s, m) => s + Number(m[1]), 0);
    if (seconds < MIN_PLAYABLE_SECONDS) return false;
  }
  return true;
}

async function runLimited<T>(items: T[], worker: (item: T) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(CHECK_CONCURRENCY, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/** Recalcula Title.hlsReady das séries a partir dos episódios. */
async function refreshSeriesReady(titleIds?: string[]) {
  if (titleIds && titleIds.length === 0) return;
  if (titleIds) {
    await prisma.$executeRaw`
      UPDATE "Title" t SET "hlsReady" = EXISTS (
        SELECT 1 FROM "Episode" e WHERE e."titleId" = t.id AND e."hlsReady" = true
      )
      WHERE t.type IN ('SERIES', 'ANIME') AND t.id = ANY(${titleIds})`;
  } else {
    await prisma.$executeRaw`
      UPDATE "Title" t SET "hlsReady" = EXISTS (
        SELECT 1 FROM "Episode" e WHERE e."titleId" = t.id AND e."hlsReady" = true
      )
      WHERE t.type IN ('SERIES', 'ANIME')`;
  }
}

export type HlsReadySyncResult = {
  checked: number;
  becameReady: number;
  becameNotReady: number;
  errors: number;
};

/**
 * Confere o storage e atualiza hlsReady.
 * - prefix: confere só o que usa esse caminho (chamado pelo conversor ao terminar um job).
 * - sem prefix: confere tudo que tem hlsPath (rede de segurança periódica).
 */
export async function syncHlsReady(opts: { prefix?: string; deep?: boolean } = {}): Promise<HlsReadySyncResult> {
  // Quem ainda não está pronto (ou tudo, com deep/prefix) passa pela conferência completa;
  // quem já está pronto só confirma que o master continua lá.
  const check = (prefix: string, currentlyReady: boolean) =>
    currentlyReady && !opts.deep && !opts.prefix ? masterExists(prefix) : isPlayable(prefix);

  const result: HlsReadySyncResult = { checked: 0, becameReady: 0, becameNotReady: 0, errors: 0 };

  const prefixFilter = opts.prefix ? normalizePrefix(opts.prefix) : null;
  const pathWhere: Prisma.StringNullableFilter = prefixFilter
    ? { in: [prefixFilter, prefixFilter.slice(0, -1), `/${prefixFilter}`, `/${prefixFilter.slice(0, -1)}`] }
    : { not: null };

  const [episodes, movies] = await Promise.all([
    prisma.episode.findMany({
      where: { hlsPath: pathWhere },
      select: { id: true, titleId: true, hlsPath: true, hlsReady: true },
    }),
    prisma.title.findMany({
      where: { hlsPath: pathWhere, type: { notIn: ["SERIES", "ANIME"] } },
      select: { id: true, hlsPath: true, hlsReady: true },
    }),
  ]);

  const touchedSeries = new Set<string>();

  await runLimited(episodes, async (ep) => {
    if (!ep.hlsPath || !ep.hlsPath.trim()) return;
    result.checked++;
    try {
      const ready = await check(ep.hlsPath, ep.hlsReady);
      if (ready !== ep.hlsReady) {
        await prisma.episode.update({ where: { id: ep.id }, data: { hlsReady: ready } });
        if (ready) result.becameReady++;
        else result.becameNotReady++;
      }
      touchedSeries.add(ep.titleId);
    } catch {
      result.errors++;
    }
  });

  await runLimited(movies, async (t) => {
    if (!t.hlsPath || !t.hlsPath.trim()) return;
    result.checked++;
    try {
      const ready = await check(t.hlsPath, t.hlsReady);
      if (ready !== t.hlsReady) {
        await prisma.title.update({ where: { id: t.id }, data: { hlsReady: ready } });
        if (ready) result.becameReady++;
        else result.becameNotReady++;
      }
    } catch {
      result.errors++;
    }
  });

  await refreshSeriesReady(prefixFilter ? Array.from(touchedSeries) : undefined);

  return result;
}
