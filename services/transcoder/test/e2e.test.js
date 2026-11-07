import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../src/config.js";
import { createStorageClient } from "../src/storage.js";
import { TranscodeQueue } from "../src/queue.js";
import { createTranscoderServer } from "../src/server.js";
import { startMockS3Server } from "./mock-s3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_ENTRY = path.resolve(__dirname, "..", "src", "index.js");

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
