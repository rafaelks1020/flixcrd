import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const TEXT_SUBTITLE_CODECS = new Set([
  "subrip",
  "srt",
  "ass",
  "ssa",
  "mov_text",
  "webvtt",
  "text",
  "ttml",
  "sami",
  "microdvd",
  "mpl2",
  "jacosub",
  "subviewer",
  "subviewer1",
  "realtext",
  "stl",
  "vplayer",
  "pjs",
]);

function runCommand(command, args, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const onAbort = () => {
      child.kill("SIGTERM");
    };

    if (signal) {
      if (signal.aborted) {
        child.kill("SIGTERM");
        return reject(new Error("Processo abortado."));
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf-8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
      if (stderr.length > 16384) {
        stderr = stderr.slice(-16384);
      }
    });

    child.on("error", (err) => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(err);
    });

    child.on("close", (code) => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const detail = stderr.trim().split("\n").slice(-5).join(" | ");
        reject(new Error(`Comando ${command} falhou (codigo ${code}): ${detail || "sem detalhes"}`));
      }
    });
  });
}

function getStreamRotation(videoStream) {
  const tagRotate = Number(videoStream?.tags?.rotate ?? 0);
  if (Number.isFinite(tagRotate) && tagRotate !== 0) {
    return tagRotate;
  }
  const sideData = Array.isArray(videoStream?.side_data_list) ? videoStream.side_data_list : [];
  for (const item of sideData) {
    if (typeof item?.rotation !== "undefined") {
      const rot = Number(item.rotation);
      if (Number.isFinite(rot)) return rot;
    }
  }
  return 0;
}

function parseFrameRate(raw) {
  if (typeof raw !== "string" || !raw.includes("/")) {
    const direct = Number(raw);
    return Number.isFinite(direct) && direct > 0 && direct < 1000 ? direct : null;
  }
  const [num, den] = raw.split("/").map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  const value = num / den;
  return value > 0 && value < 1000 ? value : null;
}

/**
 * Monta o comando de uma ferramenta (ffmpeg/ffprobe), com nice apenas quando pedido e fora do Windows.
 */
function toolCommand(useNice, toolPath, args) {
  if (useNice && process.platform !== "win32") {
    return { command: "nice", args: ["-n", "15", toolPath, ...args] };
  }
  return { command: toolPath, args };
}

export const SUPPORTED_ENCODERS = ["libx264", "h264_amf", "h264_nvenc", "h264_qsv"];

/**
 * Argumentos de video do encoder escolhido. Encoders de GPU nao usam -preset/-crf do x264
 * e recebem -g (GOP de 6 s na taxa de quadros da origem) para os segmentos HLS saírem certos.
 */
export function buildVideoEncoderArgs({ encoder = "libx264", crf, fps }) {
  const q = Number(crf);
  const common = ["-pix_fmt", "yuv420p", "-profile:v", "high", "-force_key_frames", "expr:gte(t,n_forced*6)"];
  const gop = String(Math.max(1, Math.round((Number.isFinite(fps) && fps > 0 ? fps : 24) * 6)));

  switch (encoder) {
    case "libx264":
      return [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        String(q),
        ...common,
        "-sc_threshold",
        "0",
      ];
    case "h264_amf":
      return [
        "-c:v",
        "h264_amf",
        "-quality",
        "quality",
        "-rc",
        "cqp",
        "-qp_i",
        String(q),
        "-qp_p",
        String(q + 2),
        "-qp_b",
        String(q + 2),
        ...common,
        "-g",
        gop,
      ];
    case "h264_nvenc":
      return [
        "-c:v",
        "h264_nvenc",
        "-preset",
        "p5",
        "-rc",
        "vbr",
        "-cq",
        String(q),
        "-b:v",
        "0",
        "-forced-idr",
        "1",
        ...common,
        "-g",
        gop,
      ];
    case "h264_qsv":
      return ["-c:v", "h264_qsv", "-global_quality", String(q), ...common, "-g", gop];
    default:
      throw new Error(`Encoder de video nao suportado: ${encoder}`);
  }
}

/**
 * Inspeciona o arquivo de midia local com ffprobe.
 */
export async function probeMedia(filePath, signal, { ffprobePath = "ffprobe" } = {}) {
  const { stdout } = await runCommand(
    ffprobePath,
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath],
    { signal },
  );

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("Falha ao interpretar saida JSON do ffprobe.");
  }

  const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
  const format = parsed?.format ?? {};

  const videoStreams = streams.filter(
    (s) => s.codec_type === "video" && !(s.disposition && s.disposition.attached_pic === 1),
  );

  if (videoStreams.length === 0) {
    throw new Error("Nenhuma faixa de video valida encontrada no arquivo de origem.");
  }

  const videoStream =
    videoStreams.find((s) => s.disposition?.default === 1) ?? videoStreams[0];

  let width = Number(videoStream.width ?? 0);
  let height = Number(videoStream.height ?? 0);
  const rotation = getStreamRotation(videoStream);
  if (Math.abs(rotation) % 180 === 90) {
    [width, height] = [height, width];
  }

  if (width <= 0 || height <= 0) {
    throw new Error("Dimensoes de video invalidas retornadas pelo ffprobe.");
  }

  const durationSec = Math.max(
    0,
    Number(format.duration ?? 0) || Number(videoStream.duration ?? 0) || 0,
  );

  const audioStreams = streams.filter((s) => s.codec_type === "audio");
  const audioStream =
    audioStreams.find((s) => s.disposition?.default === 1) ?? audioStreams[0] ?? null;

  const subtitleStreams = streams.filter((s) => {
    if (s.codec_type !== "subtitle") return false;
    const codec = String(s.codec_name ?? "").toLowerCase();
    return TEXT_SUBTITLE_CODECS.has(codec);
  });

  return {
    width,
    height,
    durationSec,
    fps: parseFrameRate(videoStream.avg_frame_rate) ?? parseFrameRate(videoStream.r_frame_rate),
    videoStreamIndex: Number(videoStream.index),
    audioStreamIndex: audioStream ? Number(audioStream.index) : null,
    subtitleStreams: subtitleStreams.map((s) => ({
      index: Number(s.index),
      codec: String(s.codec_name ?? "").toLowerCase(),
      language: String(s.tags?.language ?? "").trim(),
      title: String(s.tags?.title ?? "").trim(),
    })),
  };
}

/**
 * Seleciona as renditions HLS conforme a resolucao de origem, sem fazer upscale.
 */
export function selectRenditions(sourceWidth, sourceHeight) {
  const ladder = [
    { name: "1080p", height: 1080, fallbackBandwidth: 5000000 },
    { name: "720p", height: 720, fallbackBandwidth: 2800000 },
    { name: "480p", height: 480, fallbackBandwidth: 1400000 },
  ];

  const selected = ladder
    .filter((item) => sourceHeight >= item.height)
    .map((item) => {
      const scaledWidth = Math.max(
        2,
        Math.round(((sourceWidth * item.height) / sourceHeight) / 2) * 2,
      );
      return {
        ...item,
        width: scaledWidth,
      };
    });

  if (selected.length > 0) {
    return selected;
  }

  const evenHeight = Math.max(2, Math.floor(sourceHeight / 2) * 2);
  const evenWidth = Math.max(2, Math.floor(sourceWidth / 2) * 2);
  return [
    {
      name: `${evenHeight}p`,
      height: evenHeight,
      width: evenWidth,
      fallbackBandwidth: 800000,
    },
  ];
}

function buildSubtitleFilename(sub, usedNames) {
  const lang = (sub.language || "").toLowerCase();
  const title = (sub.title || "").toLowerCase();

  let suffix = "sub";
  if (
    lang === "pob" ||
    lang === "pt-br" ||
    lang === "pt_br" ||
    ((lang === "por" || lang === "pt") && /(br|braz|brasil)/.test(title))
  ) {
    suffix = "pt-br";
  } else if (lang === "por" || lang.startsWith("pt")) {
    suffix = "pt";
  } else if (lang === "eng" || lang.startsWith("en")) {
    suffix = "en";
  } else if (lang === "spa" || lang.startsWith("es")) {
    suffix = "es";
  } else if (lang) {
    const clean = lang.replace(/[^a-z0-9-]+/g, "");
    if (clean) suffix = clean;
  }

  let candidate = `subtitle-${suffix}.vtt`;
  let counter = 2;
  while (usedNames.has(candidate)) {
    candidate = `subtitle-${suffix}-${counter}.vtt`;
    counter += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

/**
 * Converte faixas de legenda de texto embutidas para arquivos .vtt.
 */
export async function extractTextSubtitles({
  inputPath,
  subtitleStreams,
  outputDir,
  threads,
  signal,
  ffmpegPath = "ffmpeg",
  useNice = true,
}) {
  if (!Array.isArray(subtitleStreams) || subtitleStreams.length === 0) {
    return [];
  }

  const usedNames = new Set();
  const generated = [];

  for (const sub of subtitleStreams) {
    const fileName = buildSubtitleFilename(sub, usedNames);
    const outPath = path.join(outputDir, fileName);

    try {
      const cmd = toolCommand(useNice, ffmpegPath, [
        "-hide_banner",
        "-y",
        "-nostdin",
        "-threads",
        String(threads),
        "-i",
        inputPath,
        "-map",
        `0:${sub.index}`,
        "-c:s",
        "webvtt",
        outPath,
      ]);
      await runCommand(cmd.command, cmd.args, { signal });

      const stat = await fs.stat(outPath).catch(() => null);
      if (stat && stat.size > 0) {
        generated.push(fileName);
      } else {
        await fs.rm(outPath, { force: true });
      }
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn(`[Transcoder] Aviso: falha ao extrair legenda stream ${sub.index}: ${err.message}`);
      await fs.rm(outPath, { force: true });
    }
  }

  return generated;
}

function parseOutTimeSeconds(progressBlock) {
  if (typeof progressBlock.out_time_us === "string") {
    const us = Number.parseInt(progressBlock.out_time_us, 10);
    if (Number.isFinite(us) && us >= 0) {
      return us / 1_000_000;
    }
  }

  if (typeof progressBlock.out_time === "string") {
    const match = progressBlock.out_time.trim().match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
    if (match) {
      const hours = Number.parseInt(match[1], 10);
      const minutes = Number.parseInt(match[2], 10);
      const seconds = Number.parseFloat(match[3]);
      if (Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(seconds)) {
        return hours * 3600 + minutes * 60 + seconds;
      }
    }
  }

  return null;
}

async function probeEncodedResolution(segmentPath, fallbackWidth, fallbackHeight, signal, ffprobePath = "ffprobe") {
  try {
    const { stdout } = await runCommand(
      ffprobePath,
      [
        "-v",
        "quiet",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        segmentPath,
      ],
      { signal },
    );
    const data = JSON.parse(stdout);
    const v = data?.streams?.[0];
    if (v?.width > 0 && v?.height > 0) {
      return { width: Number(v.width), height: Number(v.height) };
    }
  } catch {
    // Usa dimensao calculada como fallback seguro
  }
  return { width: fallbackWidth, height: fallbackHeight };
}

/**
 * Executa o ffmpeg com nice 15 para gerar uma rendition HLS VOD e reporta progresso real.
 */
export async function transcodeRendition({
  inputPath,
  outputDir,
  rendition,
  videoStreamIndex,
  audioStreamIndex,
  durationSec,
  crf,
  threads,
  signal,
  onProgress,
  encoder = "libx264",
  fps = null,
  ffmpegPath = "ffmpeg",
  ffprobePath = "ffprobe",
  useNice = true,
}) {
  const playlistName = `${rendition.name}.m3u8`;
  const playlistPath = path.join(outputDir, playlistName);
  const segmentPattern = path.join(outputDir, `${rendition.name}_%03d.ts`);

  const args = [
    "-hide_banner",
    "-y",
    "-nostdin",
    "-threads",
    String(threads),
    "-i",
    inputPath,
    "-threads",
    String(threads),
    "-map",
    `0:${videoStreamIndex}`,
  ];

  if (audioStreamIndex !== null) {
    args.push("-map", `0:${audioStreamIndex}`);
  }

  args.push(
    "-vf",
    `scale=-2:${rendition.height}`,
    ...buildVideoEncoderArgs({ encoder, crf, fps }),
  );

  if (audioStreamIndex !== null) {
    args.push("-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000");
  } else {
    args.push("-an");
  }

  args.push(
    "-f",
    "hls",
    "-hls_time",
    "6",
    "-hls_playlist_type",
    "vod",
    "-hls_flags",
    "independent_segments",
    "-hls_segment_type",
    "mpegts",
    "-hls_segment_filename",
    segmentPattern,
    "-progress",
    "pipe:1",
    "-nostats",
    playlistPath,
  );

  await new Promise((resolve, reject) => {
    const cmd = toolCommand(useNice, ffmpegPath, args);
    const child = spawn(cmd.command, cmd.args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let lastInfo = { fps: null, speed: null, outTimeSec: null };
    let stdoutRemainder = "";
    let stderrTail = "";
    let progressFields = {};

    const onAbort = () => {
      child.kill("SIGTERM");
    };

    if (signal) {
      if (signal.aborted) {
        child.kill("SIGTERM");
        return reject(new Error("Conversao ffmpeg abortada."));
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("data", (chunk) => {
      stdoutRemainder += chunk.toString("utf-8");
      const lines = stdoutRemainder.split(/\r?\n/);
      stdoutRemainder = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx <= 0) continue;

        const k = line.slice(0, eqIdx).trim();
        const v = line.slice(eqIdx + 1).trim();
        progressFields[k] = v;

        if (k === "progress") {
          const outSec = parseOutTimeSeconds(progressFields);
          const fpsValue = Number.parseFloat(progressFields.fps);
          const speedValue = Number.parseFloat(String(progressFields.speed ?? "").replace(/x$/, ""));
          lastInfo = {
            fps: Number.isFinite(fpsValue) && fpsValue > 0 ? fpsValue : lastInfo.fps,
            speed: Number.isFinite(speedValue) && speedValue > 0 ? speedValue : lastInfo.speed,
            outTimeSec: outSec ?? lastInfo.outTimeSec,
          };
          if (v === "end") {
            onProgress?.(1, lastInfo);
          } else if (outSec !== null) {
            const ratio = durationSec > 0 ? Math.min(0.99, Math.max(0, outSec / durationSec)) : null;
            onProgress?.(ratio, lastInfo);
          }
          progressFields = {};
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrTail += chunk.toString("utf-8");
      if (stderrTail.length > 16384) {
        stderrTail = stderrTail.slice(-16384);
      }
    });

    child.on("error", (err) => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(err);
    });

    child.on("close", (code) => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (code === 0) {
        onProgress?.(1, lastInfo);
        resolve();
      } else {
        const lastLines = stderrTail.trim().split("\n").slice(-6).join(" | ");
        reject(new Error(`FFmpeg falhou na rendition ${rendition.name} (codigo ${code}): ${lastLines}`));
      }
    });
  });

  const files = await fs.readdir(outputDir);
  const segmentPrefix = `${rendition.name}_`;
  const segmentFiles = files
    .filter((f) => f.startsWith(segmentPrefix) && f.endsWith(".ts"))
    .sort();

  if (segmentFiles.length === 0) {
    throw new Error(`Nenhum segmento .ts foi gerado para a rendition ${rendition.name}.`);
  }

  let totalBytes = 0;
  for (const seg of segmentFiles) {
    const st = await fs.stat(path.join(outputDir, seg));
    totalBytes += st.size;
  }

  const measuredBandwidth =
    durationSec > 0
      ? Math.max(250000, Math.round((totalBytes * 8 * 1.1) / durationSec))
      : rendition.fallbackBandwidth;

  const firstSegPath = path.join(outputDir, segmentFiles[0]);
  const { width, height } = await probeEncodedResolution(
    firstSegPath,
    rendition.width,
    rendition.height,
    signal,
    ffprobePath,
  );

  return {
    name: rendition.name,
    playlistName,
    width,
    height,
    bandwidth: measuredBandwidth,
    segmentCount: segmentFiles.length,
  };
}

function h264CodecTagForHeight(height) {
  if (height >= 1080) return "avc1.640028";
  if (height >= 720) return "avc1.64001f";
  return "avc1.64001e";
}

/**
 * Gera o arquivo master.m3u8 referenciando as playlists variantes relativas na raiz do prefixo.
 */
export async function writeMasterPlaylist(outputDir, renditionInfos, hasAudio) {
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-INDEPENDENT-SEGMENTS",
  ];

  for (const info of renditionInfos) {
    const vCodec = h264CodecTagForHeight(info.height);
    const codecs = hasAudio ? `${vCodec},mp4a.40.2` : vCodec;
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${info.bandwidth},RESOLUTION=${info.width}x${info.height},CODECS="${codecs}",NAME="${info.name}"`,
    );
    lines.push(info.playlistName);
  }

  lines.push("");
  const masterPath = path.join(outputDir, "master.m3u8");
  await fs.writeFile(masterPath, lines.join("\n"), "utf-8");
  return masterPath;
}
