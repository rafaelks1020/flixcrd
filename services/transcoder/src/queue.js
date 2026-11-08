import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runTranscodePipeline } from "./pipeline.js";
import { buildTelemetry, sanitizeTelemetry } from "./telemetry.js";
import { SERVICE_VERSION } from "./version.js";

const DESKTOP_FAILURE_LIMIT = 2;
const MAX_EVENTS = 60;
const MAX_ATTEMPTS = 30;
const VPS_ID = "vps";
const VPS_NAME = "VPS (Contabo)";

function nowSeconds() {
  return Date.now() / 1000;
}

function cleanString(value, max) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export class TranscodeQueue {
  constructor({
    workdir,
    concurrency = 1,
    threads = 6,
    s3Client,
    autoStart = true,
    encoder = "libx264",
    ffmpegPath = "ffmpeg",
    ffprobePath = "ffprobe",
    useNice = true,
    // Regras do trabalhador remoto (ajustaveis para testes)
    leaseMs = 60_000,
    desktopOnlineMs = 30_000,
    monitorIntervalMs = 5_000,
    vpsAlwaysTake = false,
  }) {
    this.workdir = workdir;
    this.jobsTempRoot = path.join(workdir, "jobs");
    this.stateFilePath = path.join(workdir, "jobs.json");
    this.concurrency = concurrency;
    this.threads = threads;
    this.s3Client = s3Client;
    this.autoStart = autoStart;
    this.encoder = encoder;
    this.ffmpegPath = ffmpegPath;
    this.ffprobePath = ffprobePath;
    this.useNice = useNice;
    this.leaseMs = leaseMs;
    this.desktopOnlineMs = desktopOnlineMs;
    this.monitorIntervalMs = monitorIntervalMs;
    this.vpsAlwaysTake = Boolean(vpsAlwaysTake);

    this.jobs = new Map();
    this.workers = new Map();
    this.activeControllers = new Map();
    this.activePromises = new Set();
    this.stopping = false;
    this._monitorTimer = null;
    this._persistChain = Promise.resolve();
    this._lastThrottleSaveMs = 0;
  }

  async init() {
    await fs.mkdir(this.jobsTempRoot, { recursive: true });

    // Remove eventuais diretorios temporarios orfaos de execucoes anteriores
    const entries = await fs.readdir(this.jobsTempRoot).catch(() => []);
    for (const entry of entries) {
      await fs.rm(path.join(this.jobsTempRoot, entry), { recursive: true, force: true });
    }

    await this._loadStateFromDisk();

    if (this.autoStart) {
      this._monitorTimer = setInterval(() => this._tick(), this.monitorIntervalMs);
      this._monitorTimer.unref?.();
      this._pump();
    }
  }

  _hydrate(job) {
    job.executor = job.executor === "desktop" || job.executor === "vps" ? job.executor : null;
    job.worker_name = typeof job.worker_name === "string" ? job.worker_name : null;
    job.worker_id = typeof job.worker_id === "string" ? job.worker_id : null;
    job.desktop_failures = Number.isFinite(job.desktop_failures) ? job.desktop_failures : 0;
    job.attempts = Array.isArray(job.attempts) ? job.attempts : [];
    job.events = Array.isArray(job.events) ? job.events : [];
    job.telemetry = job.telemetry && typeof job.telemetry === "object" ? job.telemetry : null;
    job.lease_at = Number.isFinite(job.lease_at) ? job.lease_at : null;
    return job;
  }

  async _loadStateFromDisk() {
    let raw;
    try {
      raw = await fs.readFile(this.stateFilePath, "utf-8");
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return;
      }
      throw err;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn(`[Transcoder] Aviso: estado salvo corrompido em ${this.stateFilePath}: ${err.message}`);
      return;
    }

    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    let recoveredCount = 0;

    for (const item of list) {
      if (!item || typeof item.id !== "string") continue;
      const job = this._hydrate({ ...item });
      if (job.status === "running") {
        // Reinicio do servico nao conta como falha (nem da VPS nem do Desktop)
        const previousExecutor = job.executor;
        this._endAttempt(job, "lost", "Serviço reiniciado");
        this._addEvent(job, previousExecutor, "Serviço reiniciado: job voltou para a fila");
        job.status = "queued";
        job.progress = 0;
        job.message = "Reenfileirado após reinício do serviço";
        job.error = null;
        job.telemetry = null;
        job.worker_id = null;
        job.lease_at = null;
        job.updated_at = nowSeconds();
        recoveredCount += 1;
      }
      this.jobs.set(job.id, job);
    }

    // Remove duplicatas na fila (mesmo arquivo e destino), mantendo a mais antiga.
    const seen = new Set();
    let removedDuplicates = 0;
    const ordered = Array.from(this.jobs.values()).sort((a, b) => a.created_at - b.created_at);
    for (const job of ordered) {
      if (job.status !== "queued") continue;
      const key = `${job.bucket}|${job.source_key}|${job.dest_prefix}`;
      if (seen.has(key)) {
        this.jobs.delete(job.id);
        removedDuplicates += 1;
      } else {
        seen.add(key);
      }
    }

    if (recoveredCount > 0 || removedDuplicates > 0) {
      if (recoveredCount > 0) {
        console.log(`[Transcoder] ${recoveredCount} job(s) interrompido(s) voltaram para a fila.`);
      }
      if (removedDuplicates > 0) {
        console.log(`[Transcoder] ${removedDuplicates} job(s) duplicado(s) removido(s) da fila.`);
      }
      await this._persistNow();
    }
  }

  _persistNow() {
    const snapshot = Array.from(this.jobs.values());
    const payload = JSON.stringify({ version: 1, jobs: snapshot }, null, 2);
    const tmpPath = `${this.stateFilePath}.${process.pid}.tmp`;

    this._persistChain = this._persistChain
      .then(async () => {
        await fs.writeFile(tmpPath, payload, "utf-8");
        await fs.rename(tmpPath, this.stateFilePath);
      })
      .catch((err) => {
        console.error(`[Transcoder] Erro ao persistir fila em disco: ${err.message}`);
      });

    return this._persistChain;
  }

  _persistThrottled() {
    const now = Date.now();
    if (now - this._lastThrottleSaveMs >= 1000) {
      this._lastThrottleSaveMs = now;
      void this._persistNow();
    }
  }

  // ---------------------------------------------------------------- eventos e tentativas

  _addEvent(job, executor, text) {
    job.events.push({ at: nowSeconds(), executor: executor ?? null, text });
    if (job.events.length > MAX_EVENTS) {
      job.events.splice(0, job.events.length - MAX_EVENTS);
    }
  }

  _beginAttempt(job, { executor, workerName, workerId, encoder }) {
    const now = nowSeconds();
    const last = job.attempts[job.attempts.length - 1];
    const n = (last?.n ?? 0) + 1;
    job.attempts.push({
      n,
      executor,
      worker_name: workerName ?? null,
      encoder: encoder ?? null,
      started_at: now,
      ended_at: null,
      result: "running",
      error: null,
    });
    if (job.attempts.length > MAX_ATTEMPTS) {
      job.attempts.splice(0, job.attempts.length - MAX_ATTEMPTS);
    }
    job.status = "running";
    job.executor = executor;
    job.worker_name = workerName ?? null;
    job.worker_id = workerId ?? null;
    job.progress = 0;
    job.error = null;
    job.telemetry = null;
    job.lease_at = executor === "desktop" ? now : null;
    job.updated_at = now;
    return n;
  }

  _endAttempt(job, result, error = null) {
    for (let i = job.attempts.length - 1; i >= 0; i -= 1) {
      const attempt = job.attempts[i];
      if (attempt.result === "running") {
        attempt.result = result;
        attempt.ended_at = nowSeconds();
        attempt.error = error ? String(error).slice(0, 500) : null;
        return;
      }
    }
  }

  // ---------------------------------------------------------------- publico

  toPublicJob(job) {
    return {
      id: job.id,
      job_id: job.id,
      status: job.status,
      progress: Number((job.progress ?? 0).toFixed(1)),
      message: job.message ?? null,
      error: job.error ?? null,
      bucket: job.bucket,
      source_key: job.source_key,
      dest_prefix: job.dest_prefix,
      crf: job.crf,
      delete_source: Boolean(job.delete_source),
      title_id: job.title_id ?? null,
      episode_id: job.episode_id ?? null,
      renditions: Array.isArray(job.renditions) ? job.renditions : [],
      subtitles: Array.isArray(job.subtitles) ? job.subtitles : [],
      created_at: job.created_at,
      updated_at: job.updated_at,
      executor: job.executor ?? null,
      worker_name: job.worker_name ?? null,
      desktop_failures: job.desktop_failures ?? 0,
      attempts: Array.isArray(job.attempts) ? job.attempts.map((a) => ({ ...a })) : [],
      events: Array.isArray(job.events) ? job.events.map((e) => ({ ...e })) : [],
      telemetry: job.telemetry ?? null,
    };
  }

  async enqueue({
    bucket,
    sourceKey,
    destPrefix,
    crf = 20,
    deleteSource = false,
    titleId = null,
    episodeId = null,
  }) {
    // Idempotente: o mesmo arquivo para o mesmo destino já na fila ou convertendo
    // devolve o job existente (clicar duas vezes no admin não duplica conversão).
    for (const existing of this.jobs.values()) {
      if (
        (existing.status === "queued" || existing.status === "running") &&
        existing.bucket === bucket &&
        existing.source_key === sourceKey &&
        existing.dest_prefix === destPrefix
      ) {
        return this.toPublicJob(existing);
      }
    }

    const now = nowSeconds();
    const id = crypto.randomUUID();
    const job = this._hydrate({
      id,
      status: "queued",
      progress: 0,
      message: "Na fila aguardando conversão",
      error: null,
      bucket,
      source_key: sourceKey,
      dest_prefix: destPrefix,
      crf,
      delete_source: Boolean(deleteSource),
      title_id: titleId,
      episode_id: episodeId,
      renditions: [],
      subtitles: [],
      created_at: now,
      updated_at: now,
    });

    this.jobs.set(id, job);
    this._addEvent(job, null, "Job enfileirado");
    await this._persistNow();
    console.log(`[Transcoder] Job ${id} enfileirado para ${sourceKey} -> ${destPrefix}`);

    if (this.autoStart && !this.stopping) {
      this._pump();
    }

    return this.toPublicJob(job);
  }

  listJobs() {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.created_at - a.created_at)
      .map((job) => this.toPublicJob(job));
  }

  getJob(id) {
    const job = this.jobs.get(id);
    return job ? this.toPublicJob(job) : null;
  }

  // ---------------------------------------------------------------- trabalhadores

  isDesktopOnline() {
    const limit = nowSeconds() - this.desktopOnlineMs / 1000;
    for (const worker of this.workers.values()) {
      if (worker.last_seen >= limit) return true;
    }
    return false;
  }

  _touchWorker(workerId, info = {}) {
    let worker = this.workers.get(workerId);
    if (!worker) {
      worker = {
        id: workerId,
        name: workerId,
        gpu: null,
        encoder: null,
        version: null,
        last_seen: 0,
      };
      this.workers.set(workerId, worker);
    }
    worker.last_seen = nowSeconds();
    const name = cleanString(info.name, 64);
    if (name) worker.name = name;
    if ("gpu" in info) worker.gpu = cleanString(info.gpu, 200);
    if ("encoder" in info) worker.encoder = cleanString(info.encoder, 40);
    if ("version" in info) worker.version = cleanString(info.version, 40);
    return worker;
  }

  _workerCurrentJob(workerId) {
    for (const job of this.jobs.values()) {
      if (job.status === "running" && job.executor === "desktop" && job.worker_id === workerId) {
        return job;
      }
    }
    return null;
  }

  _ownedJob(workerId, jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return { job: null, owned: false };
    const owned = job.status === "running" && job.executor === "desktop" && job.worker_id === workerId;
    return { job, owned };
  }

  listWorkers() {
    const now = nowSeconds();
    const limit = now - this.desktopOnlineMs / 1000;

    const vpsJob = Array.from(this.jobs.values()).find(
      (j) => j.status === "running" && j.executor === "vps",
    );
    const list = [
      {
        id: VPS_ID,
        name: VPS_NAME,
        kind: "vps",
        online: true,
        last_seen: now,
        gpu: null,
        encoder: this.encoder || "libx264",
        version: SERVICE_VERSION,
        current_job_id: vpsJob ? vpsJob.id : null,
      },
    ];

    const desktops = Array.from(this.workers.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const worker of desktops) {
      const current = this._workerCurrentJob(worker.id);
      list.push({
        id: worker.id,
        name: worker.name,
        kind: "desktop",
        online: worker.last_seen >= limit,
        last_seen: worker.last_seen,
        gpu: worker.gpu,
        encoder: worker.encoder,
        version: worker.version,
        current_job_id: current ? current.id : null,
      });
    }
    return list;
  }

  /**
   * Batimento do trabalhador. cancel_job = true quando o job informado nao esta mais com ele.
   */
  heartbeat({ workerId, name, gpu, encoder, version, jobId }) {
    this._touchWorker(workerId, { name, gpu, encoder, version });
    if (!jobId) return { ok: true, cancel_job: false };

    const { job, owned } = this._ownedJob(workerId, jobId);
    if (job && owned) {
      job.lease_at = nowSeconds();
      return { ok: true, cancel_job: false };
    }
    return { ok: true, cancel_job: true };
  }

  /**
   * Entrega ao trabalhador o job queued mais antigo com menos de 2 falhas no Desktop.
   */
  async claimJob(workerId) {
    const worker = this._touchWorker(workerId, {});
    if (this.stopping) return null;
    if (this._workerCurrentJob(workerId)) return null;

    const next = Array.from(this.jobs.values())
      .filter(
        (j) =>
          j.status === "queued" &&
          !this.activeControllers.has(j.id) &&
          j.desktop_failures < DESKTOP_FAILURE_LIMIT,
      )
      .sort((a, b) => a.created_at - b.created_at)[0];
    if (!next) return null;

    // Tudo sincrono ate aqui: dois claims ou a VPS nunca pegam o mesmo job.
    const n = this._beginAttempt(next, {
      executor: "desktop",
      workerName: worker.name,
      workerId,
      encoder: worker.encoder,
    });
    next.message = "Desktop iniciou o job";
    this._addEvent(next, "desktop", `Desktop pegou o job (tentativa ${n})`);
    console.log(`[Transcoder] Job ${next.id} pego pelo trabalhador ${worker.name} (tentativa ${n}).`);
    await this._persistNow();

    return {
      id: next.id,
      bucket: next.bucket,
      source_key: next.source_key,
      dest_prefix: next.dest_prefix,
      crf: next.crf,
      delete_source: Boolean(next.delete_source),
    };
  }

  /**
   * Retorna "ok", "conflict" (job nao esta mais com o trabalhador) ou "notfound".
   */
  workerProgress({ workerId, jobId, progress, message, telemetry }) {
    const { job, owned } = this._ownedJob(workerId, jobId);
    if (!job) return "notfound";
    if (!owned) return "conflict";

    this._touchWorker(workerId, {});
    const now = nowSeconds();
    if (Number.isFinite(progress)) {
      job.progress = Math.min(100, Math.max(0, progress));
    }
    if (typeof message === "string") {
      job.message = message.slice(0, 300);
    }
    const clean = sanitizeTelemetry(telemetry);
    if (clean) job.telemetry = clean;
    job.lease_at = now;
    job.updated_at = now;
    this._persistThrottled();
    return "ok";
  }

  async workerComplete({ workerId, jobId, renditions, subtitles }) {
    const { job, owned } = this._ownedJob(workerId, jobId);
    if (!job) return "notfound";
    if (!owned) return "conflict";

    this._touchWorker(workerId, {});
    this._endAttempt(job, "ok");
    job.status = "completed";
    job.progress = 100;
    job.message = "Conversão HLS concluída";
    job.error = null;
    job.renditions = Array.isArray(renditions) ? renditions.filter((r) => typeof r === "string") : [];
    job.subtitles = Array.isArray(subtitles) ? subtitles : [];
    job.telemetry = this._finalTelemetry(job, "done", "Concluído");
    job.worker_id = null;
    job.lease_at = null;
    job.updated_at = nowSeconds();
    this._addEvent(job, "desktop", "Desktop concluiu o job");
    await this._persistNow();
    console.log(`[Transcoder] Job ${job.id} concluído pelo trabalhador.`);
    return "ok";
  }

  async workerFail({ workerId, jobId, error }) {
    const { job, owned } = this._ownedJob(workerId, jobId);
    if (!job) return "notfound";
    if (!owned) return "conflict";

    this._touchWorker(workerId, {});
    const text = cleanString(error, 500) ?? "Erro desconhecido no Desktop";
    this._failDesktop(job, "error", text, `Desktop falhou: ${text}`);
    await this._persistNow();
    return "ok";
  }

  /**
   * Devolve o job do Desktop para a fila contando a falha. result: "error" ou "lost".
   */
  _failDesktop(job, result, errorText, eventText) {
    this._endAttempt(job, result, errorText);
    job.desktop_failures += 1;
    job.status = "queued";
    job.progress = 0;
    job.message =
      result === "lost" ? "Desktop parou de responder; aguardando nova tentativa" : `Falha no Desktop: ${errorText}`;
    job.error = null;
    job.telemetry = null;
    job.worker_id = null;
    job.lease_at = null;
    job.updated_at = nowSeconds();
    this._addEvent(job, "desktop", eventText);
    if (job.desktop_failures === DESKTOP_FAILURE_LIMIT) {
      this._addEvent(job, "desktop", "Duas falhas no Desktop: passando para a VPS (Contabo)");
    }
    console.warn(`[Transcoder] Job ${job.id}: ${eventText} (falhas no Desktop: ${job.desktop_failures}).`);
  }

  _finalTelemetry(job, phase, label) {
    const base = job.telemetry && typeof job.telemetry === "object" ? job.telemetry : {};
    const attempt = job.attempts[job.attempts.length - 1];
    return buildTelemetry({
      ...base,
      phase,
      phase_label: label,
      eta_sec: phase === "done" ? 0 : null,
      encoder: base.encoder ?? attempt?.encoder ?? null,
      elapsed_sec: attempt ? nowSeconds() - attempt.started_at : base.elapsed_sec,
      updated_at: nowSeconds(),
    });
  }

  // ---------------------------------------------------------------- execucao na VPS

  _vpsMayTake(job, desktopOnline) {
    if (this.vpsAlwaysTake) return true;
    return !desktopOnline || job.desktop_failures >= DESKTOP_FAILURE_LIMIT;
  }

  /**
   * Reavalia a cada intervalo: lease vencido do Desktop e job que a VPS pode assumir.
   */
  _tick() {
    if (this.stopping) return;
    const now = nowSeconds();
    let changed = false;

    for (const job of this.jobs.values()) {
      if (job.status !== "running" || job.executor !== "desktop") continue;
      const lastBeat = job.lease_at ?? job.updated_at;
      if (now - lastBeat > this.leaseMs / 1000) {
        this._failDesktop(
          job,
          "lost",
          "Sem progresso nem batimento do Desktop dentro do prazo",
          "Desktop parou de responder",
        );
        changed = true;
      }
    }

    if (changed) {
      void this._persistNow();
    }
    this._pump();
  }

  _pump() {
    if (this.stopping) return;

    while (this.activeControllers.size < this.concurrency) {
      const desktopOnline = this.isDesktopOnline();
      const nextJob = Array.from(this.jobs.values())
        .filter(
          (j) =>
            j.status === "queued" &&
            !this.activeControllers.has(j.id) &&
            this._vpsMayTake(j, desktopOnline),
        )
        .sort((a, b) => a.created_at - b.created_at)[0];

      if (!nextJob) break;

      const controller = new AbortController();
      this.activeControllers.set(nextJob.id, controller);

      const promise = this._executeJob(nextJob, controller.signal).finally(() => {
        this.activeControllers.delete(nextJob.id);
        this.activePromises.delete(promise);
        if (!this.stopping) {
          this._pump();
        }
      });

      this.activePromises.add(promise);
    }
  }

  _applyUpdate(job, { progress, message, telemetry }) {
    if (job.status !== "running") return;
    job.progress = Math.min(100, Math.max(0, progress));
    if (typeof message === "string") {
      job.message = message;
    }
    if (telemetry) job.telemetry = telemetry;
    job.updated_at = nowSeconds();
    this._persistThrottled();
  }

  async _executeJob(job, signal) {
    const jobDir = path.join(this.jobsTempRoot, job.id);

    // Marca como running de forma sincrona (antes de qualquer await) para nao haver corrida com claim.
    const attemptNumber = this._beginAttempt(job, {
      executor: "vps",
      workerName: VPS_NAME,
      workerId: VPS_ID,
      encoder: this.encoder,
    });
    job.message = "Iniciando download do arquivo de origem";
    this._addEvent(job, "vps", `${VPS_NAME} pegou o job (tentativa ${attemptNumber})`);
    await this._persistNow();

    console.log(`[Transcoder] Iniciando job ${job.id} (${job.source_key}) na VPS`);

    try {
      const result = await runTranscodePipeline({
        job,
        s3Client: this.s3Client,
        workdir: this.jobsTempRoot,
        threads: this.threads,
        encoder: this.encoder,
        ffmpegPath: this.ffmpegPath,
        ffprobePath: this.ffprobePath,
        useNice: this.useNice,
        signal,
        onUpdate: (update) => this._applyUpdate(job, update),
      });

      job.renditions = result.renditions;
      job.subtitles = result.subtitles;
      this._endAttempt(job, "ok");
      job.status = "completed";
      job.progress = 100;
      job.message = "Conversão HLS concluída";
      job.error = null;
      job.telemetry = this._finalTelemetry(job, "done", "Concluído");
      job.updated_at = nowSeconds();
      this._addEvent(job, "vps", `${VPS_NAME} concluiu o job`);
      await this._persistNow();
      console.log(`[Transcoder] Job ${job.id} concluído com sucesso.`);
    } catch (err) {
      if (this.stopping || signal?.aborted) {
        this._endAttempt(job, "lost", "Interrompido no encerramento do serviço");
        job.status = "queued";
        job.progress = 0;
        job.message = "Interrompido no encerramento; aguardando retomada";
        job.error = null;
        job.telemetry = null;
        job.worker_id = null;
        job.updated_at = nowSeconds();
        this._addEvent(job, "vps", "Interrompido no encerramento do serviço; job voltou para a fila");
        await this._persistNow();
        console.log(`[Transcoder] Job ${job.id} interrompido por parada do serviço e devolvido para a fila.`);
      } else {
        const errMessage = err instanceof Error ? err.message : "Erro desconhecido na conversão HLS";
        this._endAttempt(job, "error", errMessage);
        job.status = "error";
        job.error = errMessage;
        job.message = errMessage;
        job.telemetry = this._finalTelemetry(job, "error", "Erro na conversão");
        job.updated_at = nowSeconds();
        this._addEvent(job, "vps", `${VPS_NAME} falhou: ${errMessage}`.slice(0, 600));
        await this._persistNow();
        console.error(`[Transcoder] Job ${job.id} falhou: ${errMessage}`);
      }
    } finally {
      await fs.rm(jobDir, { recursive: true, force: true }).catch((cleanErr) => {
        console.error(`[Transcoder] Erro ao limpar diretório temporário ${jobDir}: ${cleanErr.message}`);
      });
    }
  }

  async shutdown() {
    this.stopping = true;
    if (this._monitorTimer) {
      clearInterval(this._monitorTimer);
      this._monitorTimer = null;
    }
    for (const controller of this.activeControllers.values()) {
      controller.abort();
    }
    await Promise.allSettled(Array.from(this.activePromises));
    await this._persistNow();
  }
}
