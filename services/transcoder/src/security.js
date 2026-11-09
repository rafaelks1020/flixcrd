import crypto from "node:crypto";

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

/**
 * Verifica o header Authorization: Bearer <token> em tempo constante.
 */
export function verifyBearerToken(authHeader, expectedToken) {
  if (typeof authHeader !== "string" || typeof expectedToken !== "string" || !expectedToken) {
    return false;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }

  const provided = match[1].trim();
  if (!provided) {
    return false;
  }

  const hashProvided = crypto.createHash("sha256").update(provided, "utf-8").digest();
  const hashExpected = crypto.createHash("sha256").update(expectedToken, "utf-8").digest();

  const hashesMatch = crypto.timingSafeEqual(hashProvided, hashExpected);
  return hashesMatch && provided.length === expectedToken.length;
}

function hasUnsafeKeyMarks(value) {
  const lower = value.toLowerCase();
  if (value.includes("..")) return true;
  if (value.includes("\\")) return true;
  if (value.includes("//")) return true;
  if (lower.includes("%2e") || lower.includes("%2f") || lower.includes("%5c")) return true;
  if (CONTROL_CHARS.test(value)) return true;

  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) {
      if (decoded.startsWith("/")) return true;
      if (decoded.includes("..") || decoded.includes("\\") || decoded.includes("//")) return true;
      if (CONTROL_CHARS.test(decoded)) return true;
    }
  } catch {
    return true;
  }

  return false;
}

/**
 * Valida a chave do arquivo de origem no bucket (sem barra inicial, sem ..).
 */
export function validateSourceKey(rawKey) {
  if (typeof rawKey !== "string") {
    throw new ValidationError("Campo source_key e obrigatorio.");
  }
  const key = rawKey.trim();
  if (!key) {
    throw new ValidationError("Campo source_key nao pode ser vazio.");
  }
  if (key.startsWith("/")) {
    throw new ValidationError("Campo source_key nao pode iniciar com barra.");
  }
  if (key.endsWith("/")) {
    throw new ValidationError("Campo source_key deve apontar para um arquivo, nao um prefixo.");
  }
  // Saida do proprio conversor (480p_000.ts, playlists, legendas) nunca e origem:
  // converter um segmento sobrescreve o episodio com poucos segundos.
  if (/(\.m3u8|\.vtt)$|(^|\/)\d{3,4}p_\d+\.ts$/i.test(key)) {
    throw new ValidationError("Campo source_key aponta para saida HLS ja convertida, nao para o video de origem.");
  }
  if (hasUnsafeKeyMarks(key)) {
    throw new ValidationError("Campo source_key contem caracteres ou sequencias invalidas.");
  }
  return key;
}

/**
 * Valida e normaliza o prefixo de destino no bucket (sem barra inicial, sem .., termina com /).
 */
export function validateDestPrefix(rawPrefix) {
  if (typeof rawPrefix !== "string") {
    throw new ValidationError("Campo dest_prefix e obrigatorio.");
  }
  const trimmed = rawPrefix.trim();
  if (!trimmed) {
    throw new ValidationError("Campo dest_prefix nao pode ser vazio.");
  }
  if (trimmed.startsWith("/")) {
    throw new ValidationError("Campo dest_prefix nao pode iniciar com barra.");
  }
  if (hasUnsafeKeyMarks(trimmed)) {
    throw new ValidationError("Campo dest_prefix contem caracteres ou sequencias invalidas.");
  }
  const normalized = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  if (normalized.includes("//")) {
    throw new ValidationError("Campo dest_prefix contem barras duplicadas.");
  }
  return normalized;
}

/**
 * Valida o nome do bucket.
 */
export function validateBucketName(rawBucket) {
  if (typeof rawBucket !== "string" || !rawBucket.trim()) {
    throw new ValidationError("Bucket S3 nao informado e S3_BUCKET_NAME nao configurado.");
  }
  const bucket = rawBucket.trim();
  if (
    bucket.includes("/") ||
    bucket.includes("\\") ||
    bucket.includes("..") ||
    /\s/.test(bucket) ||
    CONTROL_CHARS.test(bucket)
  ) {
    throw new ValidationError("Nome de bucket invalido.");
  }
  return bucket;
}

/**
 * Valida o parametro CRF (qualidade x264: 0 a 51, padrao 20).
 */
export function validateCrf(rawCrf, fallback = 20) {
  if (typeof rawCrf === "undefined" || rawCrf === null || rawCrf === "") {
    return fallback;
  }
  const num = Number(rawCrf);
  if (!Number.isFinite(num) || num < 0 || num > 51) {
    throw new ValidationError("Campo crf invalido: esperado numero entre 0 e 51.");
  }
  return Math.round(num);
}
