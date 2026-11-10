import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../src/config.js";
import { createStorageClient } from "../src/storage.js";
import { TranscodeQueue, isTransientError } from "../src/queue.js";
import { createTranscoderServer } from "../src/server.js";
import { startMockS3Server } from "./mock-s3.js";
import { buildVideoEncoderArgs } from "../src/ffmpeg.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_ENTRY = path.resolve(__dirname, "..", "src", "index.js");
const WORKER_ENTRY = path.resolve(__dirname, "..", "src", "worker.js");

function execTool(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString("utf-8");
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString("utf-8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} saiu com codigo ${code}: ${stderr}`));
    });
  });
}

test("recusa iniciar sem TRANSCODER_TOKEN configurado", async () => {
  assert.throws(() => loadConfig({}), /TRANSCODER_TOKEN/);

  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, [INDEX_ENTRY], {
      env: { PATH: process.env.PATH, TRANSCODER_TOKEN: "" },
      stdio: "ignore",
    });
    child.on("close", resolve);
  });

  assert.equal(exitCode, 1);
});

test("reverte job interrompido de running para queued ao reiniciar", async () => {
  const tempWorkdir = await fs.mkdtemp(path.join(os.tmpdir(), "pflix-transcoder-persist-"));
  try {
    const stateFile = path.join(tempWorkdir, "jobs.json");
    await fs.writeFile(
      stateFile,
      JSON.stringify({
        version: 1,
        jobs: [
          {
            id: "job-interrompido",
            status: "running",
            progress: 47.5,
            message: "Convertendo HLS (720p)",
            error: null,
            bucket: "bkt",
            source_key: "titles/x/video.mkv",
            dest_prefix: "titles/x/",
            crf: 20,
            delete_source: false,
            created_at: 1700000000,
            updated_at: 1700000050,
          },
        ],
      }),
      "utf-8",
    );

    const queue = new TranscodeQueue({
      workdir: tempWorkdir,
      concurrency: 1,
      threads: 2,
      s3Client: null,
      autoStart: false,
    });

    await queue.init();
    const recovered = queue.getJob("job-interrompido");
    assert.ok(recovered);
    assert.equal(recovered.status, "queued");
    assert.equal(recovered.progress, 0);
  } finally {
    await fs.rm(tempWorkdir, { recursive: true, force: true });
  }
});

test("fluxo ponta a ponta: video 10s 1280x720 -> HLS VOD (master + 720p + 480p + legenda .vtt)", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pflix-transcoder-e2e-"));
  const workdir = path.join(tempRoot, "workdir");
  const fixtureDir = path.join(tempRoot, "fixtures");
  await fs.mkdir(fixtureDir, { recursive: true });

  const mockS3 = await startMockS3Server();
  let server;
  let queue;

  try {
    // 1. Gera legenda SRT e video de 10 s 1280x720 com audio e legenda embutida
    const srtPath = path.join(fixtureDir, "sample.srt");
    await fs.writeFile(
      srtPath,
      [
        "1",
        "00:00:00,500 --> 00:00:04,500",
        "Legenda de teste um",
        "",
        "2",
        "00:00:05,000 --> 00:00:09,500",
        "Legenda de teste dois",
        "",
      ].join("\n"),
      "utf-8",
    );

    const inputMkvPath = path.join(fixtureDir, "test10s.mkv");
    await execTool("ffmpeg", [
      "-hide_banner",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=10:size=1280x720:rate=24",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=10",
      "-i",
      srtPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-map",
      "2:s:0",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ac",
      "2",
      "-c:s",
      "srt",
      "-metadata:s:s:0",
      "language=por",
      "-metadata:s:s:0",
      "title=Portugues Brasil",
      inputMkvPath,
    ]);

    const bucket = "pflix-e2e-bucket";
    const sourceKey = "titles/filme-teste/original.mkv";
    const destPrefix = "titles/filme-teste/";
    const inputBytes = await fs.readFile(inputMkvPath);
    mockS3.putObject(bucket, sourceKey, inputBytes, "video/x-matroska");

    // 2. Inicia o servico de conversao HLS
    const token = "segredo-e2e-transcoder-token";
    const config = loadConfig({
      TRANSCODER_TOKEN: token,
      TRANSCODER_HOST: "127.0.0.1",
      TRANSCODER_PORT: "0",
      TRANSCODER_WORKDIR: workdir,
      TRANSCODER_CONCURRENCY: "1",
      TRANSCODER_THREADS: "4",
      S3_ENDPOINT: mockS3.endpoint,
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY_ID: "minioadmin",
      S3_SECRET_ACCESS_KEY: "minioadmin",
      S3_BUCKET_NAME: bucket,
    });

    const s3Client = createStorageClient(config.s3);
    queue = new TranscodeQueue({
      workdir: config.workdir,
      concurrency: config.concurrency,
      threads: config.threads,
      s3Client,
    });
    await queue.init();

    server = createTranscoderServer({ config, queue });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 3. Verifica exigencia de autenticacao Bearer e validacao de chaves
    const unauthRes = await fetch(`${baseUrl}/jobs`);
    assert.equal(unauthRes.status, 401);

    const badKeyRes = await fetch(`${baseUrl}/jobs/hls`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        bucket,
        source_key: "../escape/original.mkv",
        dest_prefix: destPrefix,
      }),
    });
    assert.equal(badKeyRes.status, 400);

    const leadingSlashRes = await fetch(`${baseUrl}/jobs/hls`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        bucket,
        source_key: "/titles/filme-teste/original.mkv",
        dest_prefix: destPrefix,
      }),
    });
    assert.equal(leadingSlashRes.status, 400);

    // 4. Dispara POST /jobs/hls com delete_source: true
    const createRes = await fetch(`${baseUrl}/jobs/hls`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        bucket,
        source_key: sourceKey,
        dest_prefix: destPrefix,
        crf: 22,
        delete_source: true,
        titleId: "title-123",
      }),
    });
    assert.equal(createRes.status, 202);
    const createdJob = await createRes.json();
    assert.ok(createdJob.job_id);
    assert.equal(createdJob.id, createdJob.job_id);
    assert.ok(["queued", "running"].includes(createdJob.status));

    // 5. Aguarda conclusao consultando GET /jobs/:id
    let finalJob = null;
    const deadline = Date.now() + 60_000;
    let sawIntermediateProgress = false;

    while (Date.now() < deadline) {
      const statusRes = await fetch(`${baseUrl}/jobs/${encodeURIComponent(createdJob.job_id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(statusRes.status, 200);
      const jobData = await statusRes.json();

      if (jobData.progress > 0 && jobData.progress < 100) {
        sawIntermediateProgress = true;
      }

      if (jobData.status === "completed") {
        finalJob = jobData;
        break;
      }
      if (jobData.status === "error") {
        assert.fail(`Job falhou inesperadamente: ${jobData.message || jobData.error}`);
      }

      await new Promise((r) => setTimeout(r, 120));
    }

    assert.ok(finalJob, "Job nao concluiu dentro do tempo limite");
    assert.equal(finalJob.progress, 100);
    assert.equal(finalJob.bucket, bucket);
    assert.equal(finalJob.source_key, sourceKey);
    assert.equal(finalJob.dest_prefix, destPrefix);
    assert.ok(finalJob.created_at > 1_700_000_000 && finalJob.created_at < 10_000_000_000);
    assert.ok(finalJob.updated_at >= finalJob.created_at);
    // sawIntermediateProgress pode ser false se muito rapido, mas finalJob.progress === 100 e garantido
    void sawIntermediateProgress;

    // 6. Confere listagem GET /jobs
    const listRes = await fetch(`${baseUrl}/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(listRes.status, 200);
    const jobsList = await listRes.json();
    assert.ok(Array.isArray(jobsList));
    assert.equal(jobsList.length, 1);
    assert.equal(jobsList[0].id, createdJob.job_id);
    assert.equal(jobsList[0].status, "completed");

    // 7. Confere master.m3u8 e as 2 renditions (720p e 480p, nunca 1080p)
    const masterObj = mockS3.getObject(bucket, `${destPrefix}master.m3u8`);
    assert.ok(masterObj, "master.m3u8 nao encontrado no bucket");
    const masterText = masterObj.body.toString("utf-8");

    assert.match(masterText, /^#EXTM3U/m);
    assert.match(masterText, /^720p\.m3u8$/m);
    assert.match(masterText, /^480p\.m3u8$/m);
    assert.doesNotMatch(masterText, /1080p\.m3u8/);

    for (const expected of [
      { name: "720p", width: 1280, height: 720 },
      { name: "480p", width: 854, height: 480 },
    ]) {
      const playlistObj = mockS3.getObject(bucket, `${destPrefix}${expected.name}.m3u8`);
      assert.ok(playlistObj, `${expected.name}.m3u8 nao encontrado`);
      const playlistText = playlistObj.body.toString("utf-8");

      assert.match(playlistText, /#EXT-X-PLAYLIST-TYPE:VOD/);
      assert.match(playlistText, /#EXT-X-ENDLIST/);

      const segmentLines = playlistText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));

      assert.ok(segmentLines.length >= 2, `Esperados ao menos 2 segmentos para 10s em ${expected.name}`);

      for (const segName of segmentLines) {
        assert.ok(
          mockS3.hasObject(bucket, `${destPrefix}${segName}`),
          `Segmento ${segName} ausente no bucket`,
        );
      }

      // Valida resolucao e audio AAC estereo no primeiro segmento .ts com ffprobe
      const firstSegObj = mockS3.getObject(bucket, `${destPrefix}${segmentLines[0]}`);
      const probeSegPath = path.join(fixtureDir, `verify_${expected.name}.ts`);
      await fs.writeFile(probeSegPath, firstSegObj.body);

      const { stdout } = await execTool("ffprobe", [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_streams",
        probeSegPath,
      ]);
      const probeInfo = JSON.parse(stdout);
      const vStream = probeInfo.streams.find((s) => s.codec_type === "video");
      const aStream = probeInfo.streams.find((s) => s.codec_type === "audio");

      assert.ok(vStream);
      assert.equal(vStream.codec_name, "h264");
      assert.equal(vStream.width, expected.width);
      assert.equal(vStream.height, expected.height);

      assert.ok(aStream);
      assert.equal(aStream.codec_name, "aac");
      assert.equal(aStream.channels, 2);
    }

    // 8. Confere legenda embutida convertida para .vtt
    const vttObj = mockS3.getObject(bucket, `${destPrefix}subtitle-pt-br.vtt`);
    assert.ok(vttObj, "subtitle-pt-br.vtt nao encontrado no bucket");
    const vttText = vttObj.body.toString("utf-8");
    assert.match(vttText, /^WEBVTT/);
    assert.match(vttText, /Legenda de teste um/);

    // 9. Confere remocao do original (delete_source: true) e limpeza do diretorio local
    assert.equal(mockS3.hasObject(bucket, sourceKey), false, "Arquivo original deveria ter sido removido");
    const leftoverDirs = await fs.readdir(path.join(workdir, "jobs"));
    assert.equal(leftoverDirs.length, 0, "Diretorio temporario do job deveria estar vazio");
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (queue) {
      await queue.shutdown();
    }
    await mockS3.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});


// ---------------------------------------------------------------------------
// Trabalhador remoto, regras da fila e endpoints /worker/*
// ---------------------------------------------------------------------------

const BUCKET = "pflix-worker-bucket";
const USER_TOKEN = "token-usuario-e2e";
const WORKER_TOKEN = "token-trabalhador-e2e";

async function makeSampleVideo(dir, seconds = 4) {
  await fs.mkdir(dir, { recursive: true });
  const out = path.join(dir, "sample.mkv");
  await execTool("ffmpeg", [
    "-hide_banner",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc=duration=${seconds}:size=1280x720:rate=24`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:duration=${seconds}`,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    out,
  ]);
  return fs.readFile(out);
}

async function startEnv({ workerToken = WORKER_TOKEN, queueOptions = {} } = {}) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pflix-transcoder-worker-"));
  const mockS3 = await startMockS3Server();
  const config = loadConfig({
    TRANSCODER_TOKEN: USER_TOKEN,
    ...(workerToken ? { TRANSCODER_WORKER_TOKEN: workerToken } : {}),
    TRANSCODER_PORT: "0",
    TRANSCODER_WORKDIR: path.join(tempRoot, "workdir"),
    TRANSCODER_THREADS: "2",
    S3_ENDPOINT: mockS3.endpoint,
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "minioadmin",
    S3_SECRET_ACCESS_KEY: "minioadmin",
    S3_BUCKET_NAME: BUCKET,
  });
  const queue = new TranscodeQueue({
    workdir: config.workdir,
    concurrency: 1,
    threads: config.threads,
    s3Client: createStorageClient(config.s3),
    ...queueOptions,
  });
  await queue.init();
  const server = createTranscoderServer({ config, queue });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, pathname, { token = USER_TOKEN, body } = {}) => {
    const res = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };

  return {
    tempRoot,
    mockS3,
    queue,
    server,
    baseUrl,
    call,
    worker: (pathname, body, token = WORKER_TOKEN) => call("POST", pathname, { token, body }),
    async enqueue(sourceKey, destPrefix) {
      const res = await call("POST", "/jobs/hls", {
        body: { bucket: BUCKET, source_key: sourceKey, dest_prefix: destPrefix, crf: 23 },
      });
      assert.equal(res.status, 202);
      return res.json.id;
    },
    async job(id) {
      return (await call("GET", `/jobs/${id}`)).json;
    },
    async waitFor(id, predicate, timeoutMs = 60_000) {
      const deadline = Date.now() + timeoutMs;
      let last = null;
      while (Date.now() < deadline) {
        last = await this.job(id);
        if (predicate(last)) return last;
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.fail(`Tempo esgotado esperando o job. Último estado: ${JSON.stringify(last && { status: last.status, executor: last.executor, failures: last.desktop_failures })}`);
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await queue.shutdown();
      await mockS3.close();
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
  };
}

test("endpoints /worker/* dão 404 sem TRANSCODER_WORKER_TOKEN e 401 com token errado", async () => {
  const noToken = await startEnv({ workerToken: null, queueOptions: { autoStart: false } });
  try {
    const res = await noToken.worker("/worker/heartbeat", { worker_id: "w1" }, "qualquer");
    assert.equal(res.status, 404);
    const claim = await noToken.worker("/worker/claim", { worker_id: "w1" }, USER_TOKEN);
    assert.equal(claim.status, 404);
  } finally {
    await noToken.close();
  }

  const withToken = await startEnv({ queueOptions: { autoStart: false } });
  try {
    const wrong = await withToken.worker("/worker/heartbeat", { worker_id: "w1" }, "token-errado");
    assert.equal(wrong.status, 401);
    // O token do usuário não vale para o trabalhador e vice-versa
    const userTokenOnWorker = await withToken.worker("/worker/claim", { worker_id: "w1" }, USER_TOKEN);
    assert.equal(userTokenOnWorker.status, 401);
    const workerTokenOnJobs = await withToken.call("GET", "/jobs", { token: WORKER_TOKEN });
    assert.equal(workerTokenOnJobs.status, 401);
    const noAuth = await withToken.call("POST", "/worker/claim", { token: null, body: { worker_id: "w1" } });
    assert.equal(noAuth.status, 401);
    const ok = await withToken.worker("/worker/heartbeat", { worker_id: "w1", name: "Desktop" });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.json, { ok: true, cancel_job: false });
  } finally {
    await withToken.close();
  }
});

test("GET /workers lista a VPS sempre e o Desktop após o heartbeat", async () => {
  const env = await startEnv({ queueOptions: { autoStart: false } });
  try {
    const before = await env.call("GET", "/workers");
    assert.equal(before.status, 200);
    assert.equal(before.json.workers.length, 1);
    assert.equal(before.json.workers[0].kind, "vps");
    assert.equal(before.json.workers[0].online, true);
    assert.equal(before.json.workers[0].encoder, "libx264");

    await env.worker("/worker/heartbeat", {
      worker_id: "pc-1",
      name: "Desktop",
      gpu: "AMD Radeon RX 7600",
      encoder: "h264_amf",
      version: "1.1.0",
      job_id: null,
    });
    const after = await env.call("GET", "/workers");
    const desktop = after.json.workers.find((w) => w.kind === "desktop");
    assert.equal(desktop.id, "pc-1");
    assert.equal(desktop.name, "Desktop");
    assert.equal(desktop.online, true);
    assert.equal(desktop.gpu, "AMD Radeon RX 7600");
    assert.equal(desktop.encoder, "h264_amf");
    assert.equal(desktop.current_job_id, null);
  } finally {
    await env.close();
  }
});

test("argumentos de encoder: GPU não usa -preset/-crf do x264 e define -g pelo fps da origem", () => {
  const x264 = buildVideoEncoderArgs({ encoder: "libx264", crf: 20, fps: 24 });
  assert.ok(x264.includes("-preset") && x264.includes("-crf") && x264.includes("-sc_threshold"));

  const amf = buildVideoEncoderArgs({ encoder: "h264_amf", crf: 20, fps: 23.976 });
  assert.equal(amf[amf.indexOf("-qp_i") + 1], "20");
  assert.equal(amf[amf.indexOf("-qp_p") + 1], "22");
  assert.equal(amf[amf.indexOf("-qp_b") + 1], "22");
  assert.equal(amf[amf.indexOf("-g") + 1], "144");
  assert.ok(!amf.includes("-preset") && !amf.includes("-crf"));

  const nvenc = buildVideoEncoderArgs({ encoder: "h264_nvenc", crf: 21, fps: 30 });
  assert.equal(nvenc[nvenc.indexOf("-cq") + 1], "21");
  assert.equal(nvenc[nvenc.indexOf("-g") + 1], "180");
  assert.ok(nvenc.includes("-forced-idr") && !nvenc.includes("-crf"));

  const qsv = buildVideoEncoderArgs({ encoder: "h264_qsv", crf: 19, fps: 25 });
  assert.equal(qsv[qsv.indexOf("-global_quality") + 1], "19");
  assert.equal(qsv[qsv.indexOf("-g") + 1], "150");

  for (const args of [amf, nvenc, qsv]) {
    assert.equal(args[args.indexOf("-profile:v") + 1], "high");
    assert.equal(args[args.indexOf("-pix_fmt") + 1], "yuv420p");
  }
});

test("trabalhador remoto real: heartbeat, claim, progress, complete; job completed no desktop", async () => {
  const env = await startEnv({ queueOptions: { desktopOnlineMs: 30_000 } });
  let child = null;
  let output = "";
  try {
    const sample = await makeSampleVideo(path.join(env.tempRoot, "fixtures"));
    env.mockS3.putObject(BUCKET, "titles/remoto/original.mkv", sample, "video/x-matroska");

    child = spawn(process.execPath, [WORKER_ENTRY], {
      env: {
        PATH: process.env.PATH,
        TRANSCODER_QUEUE_URL: env.baseUrl,
        TRANSCODER_WORKER_TOKEN: WORKER_TOKEN,
        WORKER_NAME: "Desktop",
        WORKER_ID: "pc-teste",
        WORKER_ENCODER: "libx264",
        WORKER_THREADS: "2",
        WORKER_WORKDIR: path.join(env.tempRoot, "worker-work"),
        WORKER_GPU: "GPU de teste",
        S3_ENDPOINT: env.mockS3.endpoint,
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY_ID: "minioadmin",
        S3_SECRET_ACCESS_KEY: "minioadmin",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (c) => (output += c.toString()));
    child.stderr.on("data", (c) => (output += c.toString()));

    // Espera o heartbeat registrar o Desktop antes de enfileirar
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const { json } = await env.call("GET", "/workers");
      if (json.workers.some((w) => w.kind === "desktop" && w.online)) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    const id = await env.enqueue("titles/remoto/original.mkv", "titles/remoto/");
    // A VPS não pode pegar: o Desktop está online
    const final = await env.waitFor(id, (j) => j.status === "completed" || j.status === "error", 90_000);
    assert.equal(final.status, "completed", `Falhou: ${final.error}\n${output}`);
    assert.equal(final.executor, "desktop");
    assert.equal(final.worker_name, "Desktop");
    assert.equal(final.desktop_failures, 0);
    assert.equal(final.attempts.length, 1);
    assert.equal(final.attempts[0].executor, "desktop");
    assert.equal(final.attempts[0].result, "ok");
    assert.equal(final.attempts[0].encoder, "libx264");
    assert.ok(final.attempts[0].ended_at >= final.attempts[0].started_at);
    assert.ok(final.events.some((e) => /Desktop pegou o job \(tentativa 1\)/.test(e.text)));
    assert.deepEqual(final.renditions.sort(), ["480p", "720p"]);
    assert.equal(final.telemetry.phase, "done");
    assert.equal(final.telemetry.encoder, "libx264");
    assert.ok(final.telemetry.source.width === 1280 && final.telemetry.source.height === 720);

    assert.ok(env.mockS3.hasObject(BUCKET, "titles/remoto/master.m3u8"));
    assert.ok(env.mockS3.hasObject(BUCKET, "titles/remoto/720p.m3u8"));

    const workers = (await env.call("GET", "/workers")).json.workers;
    const desktop = workers.find((w) => w.kind === "desktop");
    assert.equal(desktop.gpu, "GPU de teste");
    assert.equal(desktop.encoder, "libx264");
    assert.equal(desktop.current_job_id, null);
  } finally {
    if (child) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.on("close", resolve));
    }
    await env.close();
  }
});

test("claim, progress com telemetria, 409 ao perder o job e fail devolvendo à fila", async () => {
  const env = await startEnv({
    queueOptions: { autoStart: false },
  });
  try {
    const id = await env.enqueue("titles/a/original.mkv", "titles/a/");
    const idB = await env.enqueue("titles/b/original.mkv", "titles/b/");

    const claim = await env.worker("/worker/claim", { worker_id: "w1" });
    assert.equal(claim.status, 200);
    assert.equal(claim.json.job.id, id, "deve entregar o job mais antigo");
    assert.equal(claim.json.job.bucket, BUCKET);
    assert.equal(claim.json.job.delete_source, false);

    // Mesmo trabalhador não pega outro job enquanto está ocupado
    const second = await env.worker("/worker/claim", { worker_id: "w1" });
    assert.equal(second.status, 204);

    const prog = await env.worker(`/worker/jobs/${id}/progress`, {
      worker_id: "w1",
      progress: 42.5,
      message: "Convertendo 720p (1 de 2)",
      telemetry: { phase: "transcode", phase_label: "Convertendo 720p (1 de 2)", fps: 55.2, speed_x: 2.3, elapsed_sec: 12 },
    });
    assert.equal(prog.status, 200);
    const running = await env.job(id);
    assert.equal(running.status, "running");
    assert.equal(running.progress, 42.5);
    assert.equal(running.telemetry.phase, "transcode");
    assert.equal(running.telemetry.fps, 55.2);
    assert.equal(running.telemetry.speed_x, 2.3);
    assert.equal(running.telemetry.bytes_done, null);

    // Outro trabalhador não é dono do job
    const stolen = await env.worker(`/worker/jobs/${id}/progress`, { worker_id: "w2", progress: 1 });
    assert.equal(stolen.status, 409);
    const hb = await env.worker("/worker/heartbeat", { worker_id: "w2", name: "Outro", job_id: id });
    assert.equal(hb.json.cancel_job, true);

    const fail = await env.worker(`/worker/jobs/${id}/fail`, { worker_id: "w1", error: "GPU travou" });
    assert.equal(fail.status, 200);
    const afterFail = await env.job(id);
    assert.equal(afterFail.status, "queued");
    assert.equal(afterFail.desktop_failures, 1);
    assert.equal(afterFail.attempts[0].result, "error");
    assert.equal(afterFail.attempts[0].error, "GPU travou");

    assert.deepEqual(afterFail.failed_workers, ["w1"]);

    // A mesma máquina não repete o job que falhou: pega o B; outra máquina pega o A
    const again = await env.worker("/worker/claim", { worker_id: "w1" });
    assert.equal(again.json.job.id, idB);
    const other = await env.worker("/worker/claim", { worker_id: "w3" });
    assert.equal(other.json.job.id, id);

    const late = await env.worker(`/worker/jobs/${id}/complete`, { worker_id: "w2", renditions: [], subtitles: [] });
    assert.equal(late.status, 409);
  } finally {
    await env.close();
  }
});

test("com o Desktop online a VPS não pega o job", async () => {
  const env = await startEnv({
    queueOptions: { monitorIntervalMs: 100, desktopOnlineMs: 30_000 },
  });
  try {
    await env.worker("/worker/heartbeat", { worker_id: "pc-1", name: "Desktop", encoder: "h264_amf" });
    const id = await env.enqueue("titles/inexistente/original.mkv", "titles/inexistente/");
    await new Promise((r) => setTimeout(r, 1200));
    const job = await env.job(id);
    assert.equal(job.status, "queued", "a VPS não deve pegar enquanto há Desktop online");
    assert.equal(job.attempts.length, 0);
    assert.equal(env.queue.activeControllers.size, 0);
  } finally {
    await env.close();
  }
});

test("lease vencido não conta falha; falha real na única máquina online passa para a VPS", async () => {
  const env = await startEnv({
    queueOptions: { leaseMs: 400, monitorIntervalMs: 100, desktopOnlineMs: 30_000 },
  });
  try {
    const sample = await makeSampleVideo(path.join(env.tempRoot, "fixtures"), 3);
    env.mockS3.putObject(BUCKET, "titles/lease/original.mkv", sample, "video/x-matroska");

    await env.worker("/worker/heartbeat", { worker_id: "pc-1", name: "Desktop" });
    const id = await env.enqueue("titles/lease/original.mkv", "titles/lease/");

    // Primeira tentativa: o Desktop pega e some (reinício da máquina): não é culpa do vídeo
    const claim1 = await env.worker("/worker/claim", { worker_id: "pc-1" });
    assert.equal(claim1.status, 200);
    const afterLost1 = await env.waitFor(id, (j) => j.status === "queued" && j.attempts.length === 1 && j.attempts[0].result === "lost", 5000);
    assert.equal(afterLost1.desktop_failures, 0);
    assert.equal(afterLost1.retry_at, null, "primeira perda volta na hora");
    assert.ok(afterLost1.events.some((e) => e.text === "Desktop parou de responder"));
    await new Promise((r) => setTimeout(r, 400));
    assert.equal((await env.job(id)).status, "queued", "Desktop online e sem falha real: VPS não pega");

    const staleProgress = await env.worker(`/worker/jobs/${id}/progress`, { worker_id: "pc-1", progress: 5 });
    assert.equal(staleProgress.status, 409);

    // Segunda tentativa: falha de verdade. Única máquina online já falhou: a VPS assume
    const claim2 = await env.worker("/worker/claim", { worker_id: "pc-1" });
    assert.equal(claim2.status, 200);
    const fail = await env.worker(`/worker/jobs/${id}/fail`, { worker_id: "pc-1", error: "FFmpeg falhou na rendition 480p" });
    assert.equal(fail.status, 200);
    const final = await env.waitFor(id, (j) => j.status === "completed" || j.status === "error", 90_000);
    assert.equal(final.status, "completed", `Falhou: ${final.error}`);
    assert.equal(final.executor, "vps");
    assert.equal(final.desktop_failures, 1);
    assert.deepEqual(
      final.attempts.map((a) => [a.executor, a.result]),
      [
        ["desktop", "lost"],
        ["desktop", "error"],
        ["vps", "ok"],
      ],
    );
    assert.ok(final.events.length <= 60);
    assert.equal(final.telemetry.phase, "done");
    assert.ok(env.mockS3.hasObject(BUCKET, "titles/lease/master.m3u8"));
  } finally {
    await env.close();
  }
});

test("máquina que falha 3 jobs seguidos fica de castigo e não manda jobs para a VPS", async () => {
  const env = await startEnv({ queueOptions: { autoStart: false } });
  try {
    const ids = [];
    for (const n of [1, 2, 3, 4]) ids.push(await env.enqueue(`titles/q${n}/original.mkv`, `titles/q${n}/`));
    for (let i = 0; i < 3; i++) {
      const c = await env.worker("/worker/claim", { worker_id: "note" });
      assert.equal(c.json.job.id, ids[i]);
      await env.worker(`/worker/jobs/${ids[i]}/fail`, { worker_id: "note", error: "Driver does not support the required nvenc API version" });
    }
    const blocked = await env.worker("/worker/claim", { worker_id: "note" });
    assert.equal(blocked.status, 204, "em castigo não recebe job");
    for (const id of ids.slice(0, 3)) assert.equal((await env.job(id)).desktop_failures, 1);
    const note = (await env.call("GET", "/workers")).json.workers.find((w) => w.id === "note");
    assert.ok(note.quarantined_until > Date.now() / 1000);
    // Outra máquina saudável pega o job que o Notebook falhou
    const ok = await env.worker("/worker/claim", { worker_id: "pc-2" });
    assert.equal(ok.json.job.id, ids[0]);
  } finally {
    await env.close();
  }
});

test("erro passageiro no Desktop (disco cheio) não conta falha e volta com espera", async () => {
  const env = await startEnv({ queueOptions: { autoStart: false } });
  try {
    const id = await env.enqueue("titles/disco/original.mkv", "titles/disco/");
    await env.worker("/worker/claim", { worker_id: "pc-1" });
    await env.worker(`/worker/jobs/${id}/fail`, { worker_id: "pc-1", error: "ENOSPC: no space left on device, write" });
    const j = await env.job(id);
    assert.equal(j.status, "queued");
    assert.equal(j.desktop_failures, 0);
    assert.ok(j.retry_at > Date.now() / 1000, "tem espera antes da nova tentativa");
    const early = await env.worker("/worker/claim", { worker_id: "pc-2" });
    assert.equal(early.status, 204, "não entrega antes da hora");
  } finally {
    await env.close();
  }
});

test("classificação de erro passageiro", () => {
  for (const t of ["The specified bucket does not exist", "ENOSPC: no space left on device", "socket hang up", "read ECONNRESET"])
    assert.ok(isTransientError(t), t);
  for (const t of ["FFmpeg falhou na rendition 480p (codigo 1): Invalid data found", "UnknownError", "frame=503 fps=24"])
    assert.ok(!isTransientError(t), t);
});

test("VPS assume sozinha quando o Desktop fica offline (heartbeat vencido)", async () => {
  const env = await startEnv({
    queueOptions: { monitorIntervalMs: 100, desktopOnlineMs: 500 },
  });
  try {
    const sample = await makeSampleVideo(path.join(env.tempRoot, "fixtures"), 3);
    env.mockS3.putObject(BUCKET, "titles/offline/original.mkv", sample, "video/x-matroska");

    await env.worker("/worker/heartbeat", { worker_id: "pc-1", name: "Desktop" });
    const id = await env.enqueue("titles/offline/original.mkv", "titles/offline/");
    assert.equal((await env.job(id)).status, "queued");

    const final = await env.waitFor(id, (j) => j.status === "completed" || j.status === "error", 90_000);
    assert.equal(final.status, "completed", `Falhou: ${final.error}`);
    assert.equal(final.executor, "vps");
    assert.equal(final.desktop_failures, 0);
    assert.equal(final.attempts.length, 1);
  } finally {
    await env.close();
  }
});

test("reinício recupera job do Desktop como queued sem contar falha e com evento", async () => {
  const tempWorkdir = await fs.mkdtemp(path.join(os.tmpdir(), "pflix-transcoder-restart-"));
  try {
    await fs.writeFile(
      path.join(tempWorkdir, "jobs.json"),
      JSON.stringify({
        version: 1,
        jobs: [
          {
            id: "job-desktop",
            status: "running",
            progress: 30,
            message: "x",
            error: null,
            bucket: "b",
            source_key: "a/b.mkv",
            dest_prefix: "a/",
            crf: 20,
            delete_source: false,
            executor: "desktop",
            worker_name: "Desktop",
            worker_id: "pc-1",
            desktop_failures: 1,
            attempts: [
              { n: 1, executor: "desktop", worker_name: "Desktop", encoder: "h264_amf", started_at: 1, ended_at: null, result: "running", error: null },
            ],
            events: [],
            created_at: 1700000000,
            updated_at: 1700000010,
          },
        ],
      }),
    );
    const queue = new TranscodeQueue({ workdir: tempWorkdir, s3Client: null, autoStart: false });
    await queue.init();
    const job = queue.getJob("job-desktop");
    assert.equal(job.status, "queued");
    assert.equal(job.desktop_failures, 1);
    assert.equal(job.attempts[0].result, "lost");
    assert.ok(job.events.some((e) => /reiniciado/i.test(e.text)));
    assert.equal(job.telemetry, null);
  } finally {
    await fs.rm(tempWorkdir, { recursive: true, force: true });
  }
});
