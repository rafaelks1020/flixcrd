import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { downloadObjectToFile, uploadFileToS3, deleteObjectFromS3 } from "./storage.js";
import {
  probeMedia,
  selectRenditions,
  extractTextSubtitles,
  transcodeRendition,
  writeMasterPlaylist,
} from "./ffmpeg.js";

function nowSeconds() {
  return Date.now() / 1000;
}

function sanitizeSourceExtension(sourceKey) {
  const ext = path.extname(sourceKey).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(ext)) {
    return ext;
  }
  return ".bin";
}

export class TranscodeQueue {
  constructor({ workdir, concurrency = 1, threads = 6, s3Client, autoStart = true }) {
    this.workdir = workdir;
    this.jobsTempRoot = path.join(workdir, "jobs");
    this.stateFilePath = path.join(workdir, "jobs.json");
    this.concurrency = concurrency;
    this.threads = threads;
    this.s3Client = s3Client;
    this.autoStart = autoStart;

    this.jobs = new Map();
    this.activeControllers = new Map();
    this.activePromises = new Set();
    this.stopping = false;
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
      this._pump();
    }
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
      const job = { ...item };
      if (job.status === "running") {
        job.status = "queued";
        job.progress = 0;
        job.message = "Reenfileirado apos reinicio do servico";
        job.error = null;
        job.updated_at = nowSeconds();
        recoveredCount += 1;
      }
      this.jobs.set(job.id, job);
    }

    if (recoveredCount > 0) {
      console.log(`[Transcoder] ${recoveredCount} job(s) interrompido(s) voltaram para a fila.`);
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
    const now = nowSeconds();
    const id = crypto.randomUUID();
    const job = {
      id,
      status: "queued",
      progress: 0,
      message: "Na fila aguardando conversao",
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
    };

    this.jobs.set(id, job);
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

  _pump() {
    if (this.stopping) return;

    while (this.activeControllers.size < this.concurrency) {
      const nextJob = Array.from(this.jobs.values())
        .filter((j) => j.status === "queued" && !this.activeControllers.has(j.id))
        .sort((a, b) => a.created_at - b.created_at)[0];

      if (!nextJob) break;

      const controller = new AbortController();
      this.activeControllers.set(nextJob.id, controller);

      const promise = this._executeJob(nextJob, controller.signal)
        .finally(() => {
          this.activeControllers.delete(nextJob.id);
          this.activePromises.delete(promise);
          if (!this.stopping) {
            this._pump();
          }
        });

      this.activePromises.add(promise);
    }
  }

  _updateJobProgress(job, progress, message) {
    job.progress = Math.min(100, Math.max(0, progress));
    if (typeof message === "string") {
      job.message = message;
    }
    job.updated_at = nowSeconds();
    this._persistThrottled();
  }

  async _executeJob(job, signal) {
    const jobDir = path.join(this.jobsTempRoot, job.id);
    const inputDir = path.join(jobDir, "input");
    const outputDir = path.join(jobDir, "output");

    job.status = "running";
    job.progress = 0;
    job.message = "Iniciando download do arquivo de origem";
    job.error = null;
    job.updated_at = nowSeconds();
    await this._persistNow();

    console.log(`[Transcoder] Iniciando job ${job.id} (${job.source_key})`);

    try {
      await fs.mkdir(inputDir, { recursive: true });
      await fs.mkdir(outputDir, { recursive: true });

      const inputExt = sanitizeSourceExtension(job.source_key);
      const localInputPath = path.join(inputDir, `source${inputExt}`);

      // 1. Download do bucket (0% -> 5%)
      await downloadObjectToFile({
        s3: this.s3Client,
        bucket: job.bucket,
        key: job.source_key,
        destPath: localInputPath,
        signal,
        onProgress: (ratio) => {
          this._updateJobProgress(job, ratio * 5, "Baixando arquivo de origem");
        },
      });

      this._updateJobProgress(job, 5, "Analisando midia com ffprobe");

      // 2. Analise com ffprobe
      const media = await probeMedia(localInputPath, signal);
      const renditions = selectRenditions(media.width, media.height);
      console.log(
        `[Transcoder] Job ${job.id}: origem ${media.width}x${media.height} (${media.durationSec.toFixed(1)}s), renditions: ${renditions.map((r) => r.name).join(", ")}`,
      );

      // 3. Extracao de legendas de texto embutidas (.vtt) quando houver (5% -> 8%)
      let subtitleFiles = [];
      if (media.subtitleStreams.length > 0) {
        this._updateJobProgress(job, 6, "Convertendo legendas embutidas para WebVTT");
        subtitleFiles = await extractTextSubtitles({
          inputPath: localInputPath,
          subtitleStreams: media.subtitleStreams,
          outputDir,
          threads: this.threads,
          signal,
        });
        job.subtitles = subtitleFiles;
      }

      // 4. Conversao HLS VOD por rendition (8% -> 90%)
      const weights = renditions.map((r) => r.height * r.height);
      const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;
      let completedWeight = 0;
      const renditionInfos = [];

      for (let i = 0; i < renditions.length; i += 1) {
        const rendition = renditions[i];
        const weight = weights[i];
        this._updateJobProgress(
          job,
          8 + (completedWeight / totalWeight) * 82,
          `Convertendo HLS (${rendition.name})`,
        );

        const info = await transcodeRendition({
          inputPath: localInputPath,
          outputDir,
          rendition,
          videoStreamIndex: media.videoStreamIndex,
          audioStreamIndex: media.audioStreamIndex,
          durationSec: media.durationSec,
          crf: job.crf,
          threads: this.threads,
          signal,
          onProgress: (renditionRatio) => {
            const combined = (completedWeight + weight * renditionRatio) / totalWeight;
            this._updateJobProgress(
              job,
              8 + combined * 82,
              `Convertendo HLS (${rendition.name})`,
            );
          },
        });

        completedWeight += weight;
        renditionInfos.push(info);
      }

      // 5. Geracao do master.m3u8
      await writeMasterPlaylist(outputDir, renditionInfos, media.audioStreamIndex !== null);
      job.renditions = renditionInfos.map((r) => r.name);

      // 6. Upload ordenado para o bucket (90% -> 99%): .ts/.vtt primeiro, variantes .m3u8 depois, master.m3u8 por ultimo
      const allOutputFiles = await fs.readdir(outputDir);
      const segmentsAndSubs = allOutputFiles
        .filter((f) => !f.endsWith(".m3u8"))
        .sort();
      const variantPlaylists = allOutputFiles
        .filter((f) => f.endsWith(".m3u8") && f !== "master.m3u8")
        .sort();
      const uploadOrder = [
        ...segmentsAndSubs,
        ...variantPlaylists,
        ...(allOutputFiles.includes("master.m3u8") ? ["master.m3u8"] : []),
      ];

      const uploadedKeys = new Set();
      for (let idx = 0; idx < uploadOrder.length; idx += 1) {
        const fileName = uploadOrder[idx];
        const destKey = `${job.dest_prefix}${fileName}`;
        const localFilePath = path.join(outputDir, fileName);

        this._updateJobProgress(
          job,
          90 + ((idx + 1) / Math.max(1, uploadOrder.length)) * 9,
          `Enviando arquivos HLS (${idx + 1}/${uploadOrder.length})`,
        );

        await uploadFileToS3({
          s3: this.s3Client,
          bucket: job.bucket,
          key: destKey,
          filePath: localFilePath,
          signal,
        });

        uploadedKeys.add(destKey);
      }

      // 7. Remocao opcional do arquivo original no bucket
      if (job.delete_source && !uploadedKeys.has(job.source_key)) {
        this._updateJobProgress(job, 99.5, "Removendo arquivo original do bucket");
        await deleteObjectFromS3({
          s3: this.s3Client,
          bucket: job.bucket,
          key: job.source_key,
          signal,
        });
      }

      job.status = "completed";
      job.progress = 100;
      job.message = "Conversao HLS concluida";
      job.error = null;
      job.updated_at = nowSeconds();
      await this._persistNow();
      console.log(`[Transcoder] Job ${job.id} concluido com sucesso.`);
    } catch (err) {
      if (this.stopping || signal?.aborted) {
        job.status = "queued";
        job.progress = 0;
        job.message = "Interrompido no encerramento; aguardando retomada";
        job.error = null;
        job.updated_at = nowSeconds();
        await this._persistNow();
        console.log(`[Transcoder] Job ${job.id} interrompido por parada do servico e devolvido para a fila.`);
      } else {
        const errMessage = err instanceof Error ? err.message : "Erro desconhecido na conversao HLS";
        job.status = "error";
        job.error = errMessage;
        job.message = errMessage;
        job.updated_at = nowSeconds();
        await this._persistNow();
        console.error(`[Transcoder] Job ${job.id} falhou: ${errMessage}`);
      }
    } finally {
      await fs.rm(jobDir, { recursive: true, force: true }).catch((cleanErr) => {
        console.error(`[Transcoder] Erro ao limpar diretorio temporario ${jobDir}: ${cleanErr.message}`);
      });
    }
  }

  async shutdown() {
    this.stopping = true;
    for (const controller of this.activeControllers.values()) {
      controller.abort();
    }
    await Promise.allSettled(Array.from(this.activePromises));
    await this._persistNow();
  }
}
