/**
 * Upload multipart concorrente direto para o storage (via URLs pré-assinadas).
 * Extraído de src/app/admin/upload-v2/page.tsx, sem mudar o comportamento.
 */

export const MULTIPART_PART_SIZE_BYTES = 64 * 1024 * 1024;
export const MULTIPART_CONCURRENCY = 6;
export const MULTIPART_MAX_RETRIES = 3;

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

          const putRes = await fetch(uploadUrl, {
            method: "PUT",
            body: blob,
            signal: controller.signal,
          });

          if (!putRes.ok) {
            if (attempt >= MULTIPART_MAX_RETRIES) {
              throw new Error(`Erro ao enviar parte ${part.partNumber}: ${putRes.status}`);
            }
            continue;
          }

          eTag = putRes.headers.get("ETag") || putRes.headers.get("etag") || "";
          success = true;
        }

        completedParts.push({ partNumber: part.partNumber, eTag });

        uploadedBytes += blob.size;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? uploadedBytes / elapsed : 0;
        const remaining = totalSize - uploadedBytes;
        const estimatedTimeLeft = speed > 0 ? remaining / speed : 0;
        const percent = Math.round((uploadedBytes / totalSize) * 100);

        onProgress?.({
          progress: percent,
          uploadSpeed: speed,
          uploadedBytes,
          estimatedTimeLeft,
        });
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
