/**
 * Configuração do storage de objetos (qualquer provedor compatível com S3:
 * MinIO, Cloudflare R2, Backblaze, Wasabi...).
 * Os nomes S3_* são os oficiais; os antigos WASABI_* continuam aceitos
 * como alternativa para não quebrar ambientes já configurados.
 */
function pick(primary: string, legacy: string): string | undefined {
  const value = process.env[primary] ?? process.env[legacy];
  return value && value.length > 0 ? value : undefined;
}

export const storageEnv = {
  get accessKeyId() { return pick("S3_ACCESS_KEY_ID", "WASABI_ACCESS_KEY_ID"); },
  get secretAccessKey() { return pick("S3_SECRET_ACCESS_KEY", "WASABI_SECRET_ACCESS_KEY"); },
  get endpoint() { return pick("S3_ENDPOINT", "WASABI_ENDPOINT"); },
  get region() { return pick("S3_REGION", "WASABI_REGION"); },
  get bucket() { return pick("S3_BUCKET_NAME", "WASABI_BUCKET_NAME"); },
  get cdnUrl() { return pick("S3_CDN_URL", "WASABI_CDN_URL"); },
};
