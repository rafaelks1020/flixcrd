import fs from "node:fs/promises";
import path from "node:path";
import {
  downloadObjectToFile,
  uploadFileToS3,
  deleteObjectFromS3,
  sumFileSizes,
} from "./storage.js";
import {
  probeMedia,
  selectRenditions,
  extractTextSubtitles,
  transcodeRendition,
  writeMasterPlaylist,
} from "./ffmpeg.js";
import { buildTelemetry } from "./telemetry.js";

function sanitizeSourceExtension(sourceKey) {
  const ext = path.extname(sourceKey).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(ext)) {
    return ext;
  }
  return ".bin";
}

/**
 * Medidor de taxa (megabits/s) com media suavizada, atualizada no maximo a cada 500 ms.
 */
function createRateMeter() {
  let lastTime = Date.now();
  let lastBytes = 0;
  let mbps = null;
  return (bytes) => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    if (dt >= 0.5) {
      const instant = ((bytes - lastBytes) * 8) / 1_000_000 / dt;
      mbps = mbps === null ? instant : mbps * 0.6 + instant * 0.4;
      lastTime = now;
      lastBytes = bytes;
    }
    return mbps;
  };
}

function bytesEta(done, total, mbps) {
  if (!(mbps > 0) || !(total > 0)) return null;
  return Math.max(0, ((total - done) * 8) / 1_000_000 / mbps);
}

/**
 * Pipeline completo de conversao HLS: download, ffprobe, legendas, conversao por rendition,
 * master, upload ordenado e remocao opcional da origem. Funciona igual na VPS e no trabalhador remoto.
 * onUpdate({ progress, message, telemetry }) recebe a telemetria completa do contrato.
 * Retorna { renditions: string[], subtitles: string[] }.
 */
export async function runTranscodePipeline({
  job,
  s3Client,
  workdir,
  threads = 4,
  encoder = "libx264",
  ffmpegPath = "ffmpeg",
  ffprobePath = "ffprobe",
  useNice = false,
  signal,
  onUpdate,
}) {
  const jobDir = path.join(workdir, job.id);
  const inputDir = path.join(jobDir, "input");
  const outputDir = path.join(jobDir, "output");
  const startedAtMs = Date.now();

  const state = { encoder, phase: "download", phase_label: "Baixando arquivo de origem" };

  function emit(progress, message, patch = {}) {
    Object.assign(state, patch);
    const telemetry = buildTelemetry({
      ...state,
      elapsed_sec: (Date.now() - startedAtMs) / 1000,
      updated_at: Date.now() / 1000,
    });
    onUpdate?.({
      progress: Math.min(100, Math.max(0, progress)),
      message,
      telemetry,
    });
  }

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    const localInputPath = path.join(inputDir, `source${sanitizeSourceExtension(job.source_key)}`);

    // 1. Download do bucket (0% -> 5%)
    emit(0, "Baixando arquivo de origem", {
      phase: "download",
      phase_label: "Baixando arquivo de origem",
    });
    const downloadMeter = createRateMeter();
    let lastDownloadEmit = 0;
    await downloadObjectToFile({
      s3: s3Client,
      bucket: job.bucket,
      key: job.source_key,
      destPath: localInputPath,
      signal,
      onProgress: (ratio, bytesDone, bytesTotal) => {
        const now = Date.now();
        if (now - lastDownloadEmit < 250 && ratio !== 1) return;
        lastDownloadEmit = now;
        const mbps = downloadMeter(bytesDone);
        emit((ratio ?? 0) * 5, "Baixando arquivo de origem", {
          phase: "download",
          phase_label: "Baixando arquivo de origem",
          bytes_done: bytesDone,
          bytes_total: bytesTotal > 0 ? bytesTotal : null,
          mbps,
          eta_sec: bytesEta(bytesDone, bytesTotal, mbps),
        });
      },
    });

    const sourceStat = await fs.stat(localInputPath).catch(() => null);

    // 2. Analise com ffprobe
    emit(5, "Analisando mídia com ffprobe", {
      phase: "probe",
      phase_label: "Analisando mídia",
      bytes_done: null,
      bytes_total: null,
      mbps: null,
      eta_sec: null,
    });
    const media = await probeMedia(localInputPath, signal, { ffprobePath });
    const renditions = selectRenditions(media.width, media.height);
    console.log(
      `[Pipeline] Job ${job.id}: origem ${media.width}x${media.height} (${media.durationSec.toFixed(1)}s, ${media.fps ? media.fps.toFixed(2) : "?"} fps), renditions: ${renditions.map((r) => r.name).join(", ")}, encoder ${encoder}`,
    );
    state.source = {
      width: media.width,
      height: media.height,
      duration_sec: media.durationSec,
      size_bytes: sourceStat ? sourceStat.size : null,
    };
    state.duration_sec = media.durationSec;
    state.renditions_total = renditions.length;

    // 3. Extracao de legendas de texto embutidas (.vtt) quando houver (5% -> 8%)
    let subtitleFiles = [];
    if (media.subtitleStreams.length > 0) {
      emit(6, "Convertendo legendas embutidas para WebVTT", {
        phase: "subtitles",
        phase_label: "Convertendo legendas",
      });
      subtitleFiles = await extractTextSubtitles({
        inputPath: localInputPath,
        subtitleStreams: media.subtitleStreams,
        outputDir,
        threads,
        signal,
        ffmpegPath,
        useNice,
      });
    }

    // 4. Conversao HLS VOD por rendition (8% -> 90%)
    const weights = renditions.map((r) => r.height * r.height);
    const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;
    let completedWeight = 0;
    const renditionInfos = [];

    for (let i = 0; i < renditions.length; i += 1) {
      const rendition = renditions[i];
      const weight = weights[i];
      const label = `Convertendo ${rendition.name} (${i + 1} de ${renditions.length})`;
      const renditionStartMs = Date.now();
      const transcodeBase = {
        phase: "transcode",
        phase_label: label,
        rendition: rendition.name,
        rendition_index: i + 1,
        bytes_done: null,
        bytes_total: null,
        mbps: null,
        out_time_sec: 0,
        fps: null,
        speed_x: null,
        eta_sec: null,
      };
      emit(8 + (completedWeight / totalWeight) * 82, `Convertendo HLS (${rendition.name})`, transcodeBase);

      const info = await transcodeRendition({
        inputPath: localInputPath,
        outputDir,
        rendition,
        videoStreamIndex: media.videoStreamIndex,
        audioStreamIndex: media.audioStreamIndex,
        durationSec: media.durationSec,
        crf: job.crf,
        threads,
        signal,
        encoder,
        fps: media.fps,
        ffmpegPath,
        ffprobePath,
        useNice,
        onProgress: (renditionRatio, ffInfo) => {
          const ratio = renditionRatio ?? 0;
          const combined = (completedWeight + weight * ratio) / totalWeight;
          const outSec = ffInfo?.outTimeSec ?? null;

          // Velocidade efetiva: a do ffmpeg, ou a medida no relogio quando ele nao informa.
          let speed = ffInfo?.speed ?? null;
          if (!(speed > 0) && outSec > 0) {
            const wall = (Date.now() - renditionStartMs) / 1000;
            if (wall > 1) speed = outSec / wall;
          }

          let etaSec = null;
          if (speed > 0 && media.durationSec > 0 && outSec !== null) {
            const remainingCurrent = Math.max(0, media.durationSec - outSec) / speed;
            let remainingOthers = 0;
            for (let j = i + 1; j < renditions.length; j += 1) {
              remainingOthers += (media.durationSec / speed) * (renditions[j].height / rendition.height);
            }
            etaSec = remainingCurrent + remainingOthers;
          }

          emit(8 + combined * 82, `Convertendo HLS (${rendition.name})`, {
            ...transcodeBase,
            fps: ffInfo?.fps ?? null,
            speed_x: ffInfo?.speed ?? null,
            out_time_sec: outSec,
            eta_sec: etaSec,
          });
        },
      });

      completedWeight += weight;
      renditionInfos.push(info);
    }

    // 5. Geracao do master.m3u8
    await writeMasterPlaylist(outputDir, renditionInfos, media.audioStreamIndex !== null);

    // 6. Upload ordenado (90% -> 99%): .ts/.vtt primeiro, variantes .m3u8 depois, master.m3u8 por ultimo
    const allOutputFiles = await fs.readdir(outputDir);
    const segmentsAndSubs = allOutputFiles.filter((f) => !f.endsWith(".m3u8")).sort();
    const variantPlaylists = allOutputFiles
      .filter((f) => f.endsWith(".m3u8") && f !== "master.m3u8")
      .sort();
    const uploadOrder = [
      ...segmentsAndSubs,
      ...variantPlaylists,
      ...(allOutputFiles.includes("master.m3u8") ? ["master.m3u8"] : []),
    ];

    const { sizes, total: bytesTotal } = await sumFileSizes(outputDir, uploadOrder);
    const uploadMeter = createRateMeter();
    const uploadBase = {
      phase: "upload",
      rendition: null,
      rendition_index: null,
      fps: null,
      speed_x: null,
      out_time_sec: null,
      bytes_total: bytesTotal,
      files_total: uploadOrder.length,
    };
    let bytesFinished = 0;
    let filesFinished = 0;
    const inFlight = new Map(); // arquivo -> bytes ja enviados
    let lastUploadEmit = 0;

    const emitUpload = (force) => {
      const now = Date.now();
      if (!force && now - lastUploadEmit < 250) return;
      lastUploadEmit = now;
      let partial = 0;
      for (const v of inFlight.values()) partial += v;
      const bytesDone = Math.min(bytesTotal, bytesFinished + partial);
      const mbps = uploadMeter(bytesDone);
      emit(
        90 + (bytesTotal > 0 ? bytesDone / bytesTotal : filesFinished / uploadOrder.length) * 9,
        `Enviando arquivos HLS (${filesFinished}/${uploadOrder.length})`,
        {
          ...uploadBase,
          phase_label: `Enviando arquivos (${filesFinished} de ${uploadOrder.length})`,
          bytes_done: bytesDone,
          files_done: filesFinished,
          mbps,
          eta_sec: bytesEta(bytesDone, bytesTotal, mbps),
        },
      );
    };

    const uploadedKeys = new Set();
    const uploadOne = async (fileName) => {
      const destKey = `${job.dest_prefix}${fileName}`;
      const fileSize = sizes.get(fileName) ?? 0;
      inFlight.set(fileName, 0);
      await uploadFileToS3({
        s3: s3Client,
        bucket: job.bucket,
        key: destKey,
        filePath: path.join(outputDir, fileName),
        signal,
        onBytes: (loaded) => {
          inFlight.set(fileName, Math.min(fileSize, loaded));
          emitUpload(false);
        },
      });
      inFlight.delete(fileName);
      bytesFinished += fileSize;
      filesFinished += 1;
      uploadedKeys.add(destKey);
      emitUpload(false);
    };

    // Segmentos e legendas em paralelo (cada envio espera a ida e volta ate o storage: um por vez
    // deixava o link parado). Playlists depois, em ordem, e o master por ultimo.
    const concurrency = Math.max(1, Number(process.env.TRANSCODER_UPLOAD_CONCURRENCY) || 32);
    emitUpload(true);
    let next = 0;
    const runners = Array.from({ length: Math.min(concurrency, segmentsAndSubs.length) }, async () => {
      while (next < segmentsAndSubs.length) {
        if (signal?.aborted) throw new Error("Upload abortado.");
        const fileName = segmentsAndSubs[next];
        next += 1;
        await uploadOne(fileName);
      }
    });
    await Promise.all(runners);
    for (const fileName of uploadOrder.slice(segmentsAndSubs.length)) {
      await uploadOne(fileName);
    }
    emit(99, "Envio concluído", {
      ...uploadBase,
      phase_label: `Enviando arquivos (${uploadOrder.length} de ${uploadOrder.length})`,
      bytes_done: bytesTotal,
      files_done: uploadOrder.length,
      eta_sec: 0,
    });

    // 7. Remocao opcional do arquivo original no bucket
    if (job.delete_source && !uploadedKeys.has(job.source_key)) {
      emit(99.5, "Removendo arquivo original do bucket", {
        phase: "cleanup",
        phase_label: "Removendo arquivo original do bucket",
        eta_sec: null,
        mbps: null,
      });
      await deleteObjectFromS3({
        s3: s3Client,
        bucket: job.bucket,
        key: job.source_key,
        signal,
      });
    }

    return { renditions: renditionInfos.map((r) => r.name), subtitles: subtitleFiles };
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch((cleanErr) => {
      console.error(`[Pipeline] Erro ao limpar diretório temporário ${jobDir}: ${cleanErr.message}`);
    });
  }
}
