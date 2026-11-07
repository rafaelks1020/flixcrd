import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV_PATH = path.resolve(__dirname, "..", ".env");

/**
 * Carrega variaveis de um arquivo .env simples sem sobrescrever variaveis ja definidas no ambiente.
 */
export function loadDotEnvFile(envFilePath = DEFAULT_ENV_PATH, targetEnv = process.env) {
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const content = fs.readFileSync(envFilePath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (typeof targetEnv[key] === "undefined") {
      targetEnv[key] = value;
    }
  }
}

function pick(env, primary, legacy) {
  const val = env[primary] ?? env[legacy];
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : undefined;
}

function parsePositiveInt(raw, fallback, name) {
  if (typeof raw === "undefined" || String(raw).trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Variavel ${name} invalida: esperado inteiro >= 1.`);
  }
  return parsed;
}

function parsePort(raw, fallback) {
  if (typeof raw === "undefined" || String(raw).trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error("Variavel TRANSCODER_PORT invalida: esperado inteiro entre 0 e 65535.");
  }
  return parsed;
}

/**
 * Valida e retorna toda a configuracao do servico de conversao HLS.
 */
export function loadConfig(env = process.env) {
  const token = (env.TRANSCODER_TOKEN ?? "").trim();
  if (!token) {
    throw new Error("TRANSCODER_TOKEN nao configurado. O servico exige autenticacao Bearer para iniciar.");
  }

  const host = (env.TRANSCODER_HOST ?? "").trim() || "127.0.0.1";
  const port = parsePort(env.TRANSCODER_PORT, 8001);
  const workdir = (env.TRANSCODER_WORKDIR ?? "").trim() || "/var/tmp/pflix-transcoder";
  const concurrency = parsePositiveInt(env.TRANSCODER_CONCURRENCY, 1, "TRANSCODER_CONCURRENCY");
  const threads = parsePositiveInt(env.TRANSCODER_THREADS, 6, "TRANSCODER_THREADS");

  return {
    token,
    host,
    port,
    workdir,
    concurrency,
    threads,
    s3: {
      endpoint: pick(env, "S3_ENDPOINT", "WASABI_ENDPOINT"),
      region: pick(env, "S3_REGION", "WASABI_REGION") ?? "us-east-1",
      accessKeyId: pick(env, "S3_ACCESS_KEY_ID", "WASABI_ACCESS_KEY_ID"),
      secretAccessKey: pick(env, "S3_SECRET_ACCESS_KEY", "WASABI_SECRET_ACCESS_KEY"),
      defaultBucket: pick(env, "S3_BUCKET_NAME", "WASABI_BUCKET_NAME"),
    },
  };
}
