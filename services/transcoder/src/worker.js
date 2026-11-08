import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { loadDotEnvFile } from "./config.js";
import { createStorageClient } from "./storage.js";
import { runTranscodePipeline } from "./pipeline.js";
import { SUPPORTED_ENCODERS } from "./ffmpeg.js";
import { SERVICE_VERSION } from "./version.js";

const HEARTBEAT_INTERVAL_MS = 10_000;
const CLAIM_INTERVAL_MS = 5_000;
const PROGRESS_INTERVAL_MS = 2_000;
const HTTP_TIMEOUT_MS = 15_000;

function log(message) {
  console.log(`[Worker ${new Date().toISOString()}] ${message}`);
}

function warn(message) {
  console.warn(`[Worker ${new Date().toISOString()}] AVISO: ${message}`);
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    }
  });
}

function pickEnv(env, name) {
  const value = env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Le a configuracao do trabalhador remoto das variaveis de ambiente.
 */
export function loadWorkerConfig(env = process.env) {
  const queueUrl = pickEnv(env, "TRANSCODER_QUEUE_URL");
  if (!queueUrl) {
    throw new Error("TRANSCODER_QUEUE_URL não configurada (ex.: https://servidor:8001).");
  }
  const token = pickEnv(env, "TRANSCODER_WORKER_TOKEN");
  if (!token) {
    throw new Error("TRANSCODER_WORKER_TOKEN não configurado.");
  }

  const encoder = (pickEnv(env, "WORKER_ENCODER") ?? "auto").toLowerCase();
  if (encoder !== "auto" && !SUPPORTED_ENCODERS.includes(encoder)) {
    throw new Error(`WORKER_ENCODER inválido: ${encoder}. Use auto, ${SUPPORTED_ENCODERS.join(", ")}.`);
  }

  const threadsRaw = Number.parseInt(pickEnv(env, "WORKER_THREADS") ?? "", 10);
  const threads = Number.isFinite(threadsRaw) && threadsRaw >= 1 ? threadsRaw : Math.max(1, os.cpus().length);

  const niceRaw = (pickEnv(env, "WORKER_NICE") ?? "").toLowerCase();

  return {
    queueUrl: queueUrl.replace(/\/+$/, ""),
    token,
    name: pickEnv(env, "WORKER_NAME") ?? "Desktop",
    id: pickEnv(env, "WORKER_ID") ?? os.hostname(),
    s3: {
      endpoint: pickEnv(env, "S3_ENDPOINT"),
      region: pickEnv(env, "S3_REGION") ?? "us-east-1",
      accessKeyId: pickEnv(env, "S3_ACCESS_KEY_ID"),
      secretAccessKey: pickEnv(env, "S3_SECRET_ACCESS_KEY"),
    },
    ffmpegPath: pickEnv(env, "FFMPEG_PATH") ?? "ffmpeg",
    ffprobePath: pickEnv(env, "FFPROBE_PATH") ?? "ffprobe",
    encoder,
    threads,
    workdir: pickEnv(env, "WORKER_WORKDIR") ?? path.join(os.tmpdir(), "pflix-worker"),
    gpu: pickEnv(env, "WORKER_GPU") ?? null,
    // nice so faz sentido fora do Windows; desligue com WORKER_NICE=0
    useNice: process.platform !== "win32" && !["0", "false", "no", "nao"].includes(niceRaw),
  };
}

function execFileText(command, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      resolve(err ? null : String(stdout));
    });
  });
}

/**
 * Descobre o nome da GPU (so no Windows, via PowerShell). Retorna null se nao conseguir.
 */
export async function detectGpu() {
  if (process.platform !== "win32") return null;
  const out = await execFileText(
    "powershell",
    ["-NoProfile", "-Command", "(Get-CimInstance Win32_VideoController).Name"],
    10_000,
  );
  if (!out) return null;
  const names = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(", ").slice(0, 200) : null;
}

function testEncoder(ffmpegPath, encoder) {
  return new Promise((resolve) => {
    const child = spawn(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=1:size=1280x720:rate=24",
        "-c:v",
        encoder,
        "-pix_fmt",
        "yuv420p",
        "-f",
        "null",
        "-",
      ],
      { stdio: "ignore", windowsHide: true },
    );
    const timer = setTimeout(() => child.kill(), 20_000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

/**
 * Escolhe o encoder: o configurado, ou (auto) o primeiro que funciona entre nvenc, amf e qsv; senao libx264.
 */
export async function resolveEncoder(configured, ffmpegPath) {
  if (configured !== "auto") return configured;
  for (const candidate of ["h264_nvenc", "h264_amf", "h264_qsv"]) {
    log(`Testando encoder ${candidate}...`);
    if (await testEncoder(ffmpegPath, candidate)) {
      return candidate;
    }
  }
  return "libx264";
}

export class RemoteWorker {
  constructor(config) {
    this.config = config;
    this.encoder = "libx264";
    this.gpu = config.gpu;
    this.s3Client = createStorageClient(config.s3);
    this.currentJobId = null;
    this.currentController = null;
    this.currentAbortReason = null;
    this.stopping = false;
    this.stopController = new AbortController();
    this._heartbeatTimer = null;
    this._loopPromise = null;
  }

  async _api(pathname, body) {
    const res = await fetch(`${this.config.queueUrl}${pathname}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    let json = null;
    if (res.status !== 204) {
      json = await res.json().catch(() => null);
    }
    return { status: res.status, json };
  }

  async start() {
    await fs.mkdir(path.join(this.config.workdir, "jobs"), { recursive: true });
    // Limpa restos de execucoes anteriores (somente a subpasta jobs do diretorio de trabalho)
    const jobsRoot = path.join(this.config.workdir, "jobs");
    for (const entry of await fs.readdir(jobsRoot).catch(() => [])) {
      await fs.rm(path.join(jobsRoot, entry), { recursive: true, force: true });
    }

    if (!this.gpu) {
      this.gpu = await detectGpu();
    }
    this.encoder = await resolveEncoder(this.config.encoder, this.config.ffmpegPath);

    log(`Trabalhador "${this.config.name}" (id ${this.config.id}) pronto.`);
    log(`Fila: ${this.config.queueUrl} | encoder: ${this.encoder} | GPU: ${this.gpu ?? "desconhecida"} | threads: ${this.config.threads}`);

    await this._heartbeat();
    this._heartbeatTimer = setInterval(() => void this._heartbeat(), HEARTBEAT_INTERVAL_MS);
    this._loopPromise = this._loop();
  }

  async _heartbeat() {
    try {
      const { status, json } = await this._api("/worker/heartbeat", {
        worker_id: this.config.id,
        name: this.config.name,
        gpu: this.gpu,
        encoder: this.encoder,
        version: SERVICE_VERSION,
        job_id: this.currentJobId,
      });
      if (status === 401) {
        warn("Heartbeat recusado (401): confira TRANSCODER_WORKER_TOKEN.");
        return;
      }
      if (status !== 200) {
        warn(`Heartbeat respondeu ${status}.`);
        return;
      }
      if (json?.cancel_job && this.currentJobId) {
        log(`Servidor pediu para cancelar o job ${this.currentJobId}.`);
        this._abortCurrent("cancelado pelo servidor");
      }
    } catch (err) {
      warn(`Heartbeat falhou: ${err.message}`);
    }
  }

  _abortCurrent(reason) {
    this.currentAbortReason = reason;
    this.currentController?.abort();
  }

  async _loop() {
    while (!this.stopping) {
      try {
        const { status, json } = await this._api("/worker/claim", { worker_id: this.config.id });
        if (status === 200 && json?.job) {
          await this._runJob(json.job);
          continue;
        }
        if (status !== 204) {
          warn(`Claim respondeu ${status}.`);
        }
      } catch (err) {
        warn(`Claim falhou: ${err.message}`);
      }
      await sleep(CLAIM_INTERVAL_MS, this.stopController.signal);
    }
  }

  async _runJob(job) {
    log(`Job ${job.id} recebido: ${job.source_key} -> ${job.dest_prefix} (bucket ${job.bucket}, crf ${job.crf})`);
    this.currentJobId = job.id;
    this.currentAbortReason = null;
    const controller = new AbortController();
    this.currentController = controller;

    let lastSentAt = 0;
    let pending = null;
    let flushTimer = null;
    let sending = false;
    let closed = false;
    let lastPhaseLabel = "";

    const sendProgress = async (update) => {
      if (closed || controller.signal.aborted) return;
      sending = true;
      try {
        const { status } = await this._api(`/worker/jobs/${encodeURIComponent(job.id)}/progress`, {
          worker_id: this.config.id,
          progress: update.progress,
          message: update.message,
          telemetry: update.telemetry,
        });
        if (status === 409 || status === 404) {
          log(`Job ${job.id} não pertence mais a este trabalhador (HTTP ${status}). Abortando.`);
          this._abortCurrent("job tomado pelo servidor");
        }
      } catch (err) {
        warn(`Falha ao enviar progresso: ${err.message}`);
      } finally {
        sending = false;
      }
    };

    const flush = () => {
      flushTimer = null;
      if (!pending || closed) return;
      if (sending) {
        flushTimer = setTimeout(flush, 300);
        return;
      }
      const update = pending;
      pending = null;
      lastSentAt = Date.now();
      void sendProgress(update);
    };

    const onUpdate = (update) => {
      pending = update;
      const label = update.telemetry?.phase_label ?? "";
      if (label !== lastPhaseLabel) {
        lastPhaseLabel = label;
        log(`Job ${job.id}: ${label} (${update.progress.toFixed(1)}%)`);
      }
      const wait = PROGRESS_INTERVAL_MS - (Date.now() - lastSentAt);
      if (wait <= 0) {
        if (flushTimer) clearTimeout(flushTimer);
        flush();
      } else if (!flushTimer) {
        flushTimer = setTimeout(flush, wait);
      }
    };

    try {
      const result = await runTranscodePipeline({
        job,
        s3Client: this.s3Client,
        workdir: path.join(this.config.workdir, "jobs"),
        threads: this.config.threads,
        encoder: this.encoder,
        ffmpegPath: this.config.ffmpegPath,
        ffprobePath: this.config.ffprobePath,
        useNice: this.config.useNice,
        signal: controller.signal,
        onUpdate,
      });

      closed = true;
      if (flushTimer) clearTimeout(flushTimer);
      await this._finish(job, "complete", { renditions: result.renditions, subtitles: result.subtitles });
      log(`Job ${job.id} concluído.`);
    } catch (err) {
      closed = true;
      if (flushTimer) clearTimeout(flushTimer);

      if (this.stopping) {
        log(`Encerrando: devolvendo o job ${job.id}.`);
        await this._finish(job, "fail", { error: "Trabalhador encerrado" });
      } else if (controller.signal.aborted) {
        log(`Job ${job.id} abortado (${this.currentAbortReason ?? "sem motivo"}). Arquivos temporários removidos.`);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        warn(`Job ${job.id} falhou: ${message}`);
        await this._finish(job, "fail", { error: message.slice(0, 500) });
      }
    } finally {
      this.currentJobId = null;
      this.currentController = null;
    }
  }

  async _finish(job, action, payload) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const { status } = await this._api(`/worker/jobs/${encodeURIComponent(job.id)}/${action}`, {
          worker_id: this.config.id,
          ...payload,
        });
        if (status === 200) return;
        if (status === 409 || status === 404) {
          warn(`Servidor recusou ${action} do job ${job.id} (HTTP ${status}): o job já não é deste trabalhador.`);
          return;
        }
        warn(`${action} respondeu ${status} (tentativa ${attempt}).`);
      } catch (err) {
        warn(`${action} falhou (tentativa ${attempt}): ${err.message}`);
      }
      await sleep(1500);
    }
  }

  async stop() {
    if (this.stopping) return;
    this.stopping = true;
    this.stopController.abort();
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._abortCurrent("encerramento do trabalhador");
    await this._loopPromise?.catch(() => {});
  }
}

async function main() {
  loadDotEnvFile();

  let config;
  try {
    config = loadWorkerConfig(process.env);
  } catch (err) {
    console.error(`[Worker] Falha na configuração: ${err.message}`);
    process.exit(1);
  }

  const worker = new RemoteWorker(config);

  let shuttingDown = false;
  const shutdown = async (signalName) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Sinal ${signalName} recebido. Encerrando...`);
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref?.();
    await worker.stop();
    log("Trabalhador encerrado.");
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await worker.start();
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntry) {
  main().catch((err) => {
    console.error("[Worker] Erro fatal:", err);
    process.exit(1);
  });
}
