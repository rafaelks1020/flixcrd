/**
 * Upload multipart concorrente direto para o storage (via URLs pré-assinadas).
 * Extraído de src/app/admin/upload-v2/page.tsx, sem mudar o comportamento.
 */

export const MULTIPART_PART_SIZE_BYTES = 64 * 1024 * 1024;
// O storage (rclone serve s3) grava as partes em ordem e segura as adiantadas
// em memória (até 1 GB por upload no servidor). 12 x 64 MB = 768 MB cabe com
// folga e enche a banda; SlowDown eventual é repetido com espera.
export const MULTIPART_CONCURRENCY = 12;
export const MULTIPART_MAX_RETRIES = 8;

function waitBeforeRetry(attempt: number, signal: AbortSignal): Promise<void> {
  const ms = Math.min(15000, 1500 * 2 ** (attempt - 2));
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export interface UploadedPartInfo {
  partNumber: number;
  eTag: string;
}

export interface MultipartProgress {
  progress: number; // 0-100
  uploadSpeed: number; // bytes por segundo
  uploadedBytes: number;
  estimatedTimeLeft: number; // segundos
}

export interface MultipartUploadOptions {
  file: File;
  titleId: string;
  episodeId?: string;
  /** Controller criado por quem chama (para permitir cancelar). */
  controller: AbortController;
  /** Instante de início (Date.now()) usado no cálculo de velocidade. */
  startTime: number;
  onProgress?: (info: MultipartProgress) => void;
  /** Chamado a cada nova tentativa de uma parte (attempt >= 2). */
  onRetry?: (attempt: number) => void;
}

/**
 * Retorna "success" ou "cancelled". Lança Error em qualquer falha.
 */
export async function uploadMultipartFile(
  opts: MultipartUploadOptions,
): Promise<"success" | "cancelled"> {
  const { file, titleId, episodeId, controller, startTime, onProgress, onRetry } = opts;

  const startRes = await fetch("/api/wasabi/multipart/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      titleId,
      episodeId,
      filename: file.name,
      contentType: file.type,
    }),
    signal: controller.signal,
  });

  const startJson = await startRes.json();
  if (!startRes.ok) {
    throw new Error(startJson?.error ?? "Erro ao iniciar upload multipart");
  }

  const { uploadId, key } = startJson as { uploadId: string; key: string };

  const totalSize = file.size;
  const partCount = Math.ceil(totalSize / MULTIPART_PART_SIZE_BYTES);

  const parts = Array.from({ length: partCount }, (_, index) => {
    const partNumber = index + 1;
    const start = index * MULTIPART_PART_SIZE_BYTES;
    const end = Math.min(totalSize, start + MULTIPART_PART_SIZE_BYTES);
    return { partNumber, start, end };
  });

  let uploadedBytes = 0;
  /** Bytes já enviados de cada parte em andamento (progresso contínuo, não só ao fim da parte). */
  const inFlight = new Map<number, number>();
  let lastReport = 0;
  const report = (force = false) => {
    const now = Date.now();
    if (!force && now - lastReport < 250) return;
    lastReport = now;
    let sent = uploadedBytes;
    for (const v of inFlight.values()) sent += v;
    sent = Math.min(sent, totalSize);
    const elapsed = (now - startTime) / 1000;
    const speed = elapsed > 0 ? sent / elapsed : 0;
    const remaining = totalSize - sent;
    onProgress?.({
      progress: totalSize > 0 ? Math.min(100, Math.floor((sent / totalSize) * 100)) : 100,
      uploadSpeed: speed,
      uploadedBytes: sent,
      estimatedTimeLeft: speed > 0 ? remaining / speed : 0,
    });
  };
  const completedParts: UploadedPartInfo[] = [];
  let currentIndex = 0;
  let caughtError: Error | null = null;

  const worker = async () => {
    while (true) {
      const index = currentIndex;
      if (index >= parts.length || caughtError) {
        break;
      }
      currentIndex += 1;
      const part = parts[index];

      try {
        const blob = file.slice(part.start, part.end);

        let attempt = 0;
        let success = false;
        let eTag = "";

        while (attempt < MULTIPART_MAX_RETRIES && !success) {
          attempt += 1;

          if (attempt > 1) {
            onRetry?.(attempt);
            await waitBeforeRetry(attempt, controller.signal);
          }

          const partRes = await fetch("/api/wasabi/multipart/part-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, uploadId, partNumber: part.partNumber }),
            signal: controller.signal,
          });

          const partJson = await partRes.json();
          if (!partRes.ok) {
            if (attempt >= MULTIPART_MAX_RETRIES) {
              throw new Error(
                partJson?.error ?? `Erro ao gerar URL da parte ${part.partNumber}`,
              );
            }
            continue;
          }

          const { uploadUrl } = partJson as { uploadUrl: string };

          let putResult: { status: number; eTag: string };
          try {
            putResult = await putWithProgress(uploadUrl, blob, controller.signal, (loaded) => {
              inFlight.set(part.partNumber, loaded);
              report();
            });
          } catch (err) {
            inFlight.delete(part.partNumber);
            if (controller.signal.aborted) throw err;
            if (attempt >= MULTIPART_MAX_RETRIES) throw err;
            continue;
          }
          inFlight.delete(part.partNumber);

          if (putResult.status < 200 || putResult.status >= 300) {
            if (attempt >= MULTIPART_MAX_RETRIES) {
              throw new Error(`Erro ao enviar parte ${part.partNumber}: ${putResult.status}`);
            }
            continue;
          }

          eTag = putResult.eTag;
          success = true;
        }

        completedParts.push({ partNumber: part.partNumber, eTag });

        uploadedBytes += blob.size;
        report(true);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        caughtError = error as Error;
        return;
      }
    }
  };

  const workerCount = Math.min(MULTIPART_CONCURRENCY, parts.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);

  if (controller.signal.aborted) {
    return "cancelled";
  }

  if (caughtError) {
    throw caughtError;
  }

  const completeRes = await fetch("/api/wasabi/multipart/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key,
      uploadId,
      parts: completedParts.sort((a, b) => a.partNumber - b.partNumber),
    }),
    signal: controller.signal,
  });

  const completeJson = await completeRes.json();
  if (!completeRes.ok) {
    throw new Error(completeJson?.error ?? "Erro ao finalizar upload multipart");
  }

  return "success";
}

/** PUT via XHR para ter progresso por byte (fetch não expõe progresso de envio). */
function putWithProgress(
  url: string,
  body: Blob,
  signal: AbortSignal,
  onLoaded: (loaded: number) => void,
): Promise<{ status: number; eTag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onLoaded(e.loaded);
    xhr.onload = () => {
      signal.removeEventListener("abort", onAbort);
      resolve({ status: xhr.status, eTag: xhr.getResponseHeader("ETag") || "" });
    };
    xhr.onerror = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error("Falha de rede ao enviar parte"));
    };
    xhr.onabort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    xhr.send(body);
  });
}
