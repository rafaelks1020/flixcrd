import { loadDotEnvFile, loadConfig } from "./config.js";
import { createStorageClient } from "./storage.js";
import { TranscodeQueue } from "./queue.js";
import { createTranscoderServer } from "./server.js";

async function main() {
  loadDotEnvFile();

  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    console.error(`[Transcoder] Falha na configuracao: ${err.message}`);
    process.exit(1);
  }

  const s3Client = createStorageClient(config.s3);
  const queue = new TranscodeQueue({
    workdir: config.workdir,
    concurrency: config.concurrency,
    vpsAlwaysTake: config.vpsAlwaysTake,
    threads: config.threads,
    s3Client,
    onJobCompleted: config.doneWebhook
      ? async ({ dest_prefix }) => {
          // Tenta algumas vezes: o catálogo só mostra o episódio depois desse aviso
          // (e a conferência periódica cobre se todas falharem).
          for (let attempt = 1; attempt <= 4; attempt++) {
            try {
              const res = await fetch(config.doneWebhook, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
                body: JSON.stringify({ prefix: dest_prefix }),
                signal: AbortSignal.timeout(60_000),
              });
              if (res.ok) return;
              console.warn(`[Transcoder] Aviso ao site respondeu ${res.status} (tentativa ${attempt}).`);
            } catch (err) {
              console.warn(`[Transcoder] Aviso ao site falhou (tentativa ${attempt}): ${err?.message ?? err}`);
            }
            await new Promise((r) => setTimeout(r, attempt * 5000));
          }
        }
      : null,
  });

  await queue.init();

  const server = createTranscoderServer({ config, queue });

  server.listen(config.port, config.host, () => {
    const addr = server.address();
    const boundPort = typeof addr === "object" && addr ? addr.port : config.port;
    console.log(
      `[Transcoder] Servico escutando em http://${config.host}:${boundPort} (workdir=${config.workdir}, concurrency=${config.concurrency}, vpsAlwaysTake=${config.vpsAlwaysTake}, threads=${config.threads})`,
    );
  });

  let shuttingDown = false;
  const gracefulShutdown = async (signalName) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Transcoder] Sinal ${signalName} recebido. Encerrando de forma limpa...`);

    server.close();
    await queue.shutdown();
    console.log("[Transcoder] Encerrado com sucesso.");
    process.exit(0);
  };

  process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[Transcoder] Erro fatal na inicializacao:", err);
  process.exit(1);
});
