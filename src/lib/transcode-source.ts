/**
 * Escolha do arquivo de origem para converter em HLS.
 * Nunca pega a saída do próprio conversor (segmentos 480p_000.ts, playlists, legendas):
 * em 08/11 um clique durante o envio dos segmentos pegou 480p_000.ts como origem
 * e sobrescreveu o episódio com 6 segundos.
 */

type StorageObject = { Key?: string; Size?: number };

const TEMP_RE = /(^|\/)\.rclone_temp|\.partial$/i;
const OWN_OUTPUT_RE = /(\.m3u8|\.vtt)$|(^|\/)\d{3,4}p_\d+\.ts$/i;
const VIDEO_RE = /\.(mkv|mp4|mov|webm|avi|m4v|ts)$/i;

export function isConverterOutput(key: string): boolean {
  return OWN_OUTPUT_RE.test(key);
}

/** Objetos que podem ser origem (sem temporários nem saída do conversor). */
export function sourceCandidates<T extends StorageObject>(objects: T[]): T[] {
  return objects.filter((o) => o.Key && !TEMP_RE.test(o.Key) && !isConverterOutput(o.Key));
}

/** Há saída do conversor no prefixo (conversão em andamento ou já feita). */
export function hasConverterOutput(objects: StorageObject[]): boolean {
  return objects.some((o) => o.Key && isConverterOutput(o.Key));
}

export function pickSourceObject<T extends StorageObject>(objects: T[]): T | undefined {
  const candidates = sourceCandidates(objects);
  if (candidates.length === 0) return undefined;
  const video = candidates.find((o) => VIDEO_RE.test(o.Key as string));
  if (video) return video;
  return candidates.reduce((acc, o) => (Number(o.Size ?? 0) > Number(acc.Size ?? 0) ? o : acc), candidates[0]);
}
