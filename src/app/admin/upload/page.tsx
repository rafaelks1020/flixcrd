"use client";

import { FormEvent, useEffect, useState } from "react";

interface TitleOption {
  id: string;
  name: string;
  slug: string;
  hlsPath: string | null;
}

export default function AdminUploadPage() {
  const [titles, setTitles] = useState<TitleOption[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [selectedTitleId, setSelectedTitleId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  async function loadTitles() {
    setLoadingTitles(true);
    setError(null);
    try {
      const res = await fetch("/api/titles");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao carregar títulos");
      }
      setTitles(data);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar títulos");
    } finally {
      setLoadingTitles(false);
    }
  }

  useEffect(() => {
    loadTitles();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!selectedTitleId) {
      setError("Selecione um título do catálogo.");
      return;
    }
    if (!file) {
      setError("Escolha um arquivo para enviar.");
      return;
    }
    try {
      setUploading(true);
      setUploadProgress(0);

      const MAX_SINGLE_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

      const uploadSimple = async () => {
        const res = await fetch("/api/wasabi/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titleId: selectedTitleId,
            filename: file.name,
            contentType: file.type,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Erro ao gerar URL de upload");
        }

        const { uploadUrl, prefix } = data as {
          uploadUrl: string;
          prefix: string;
        };

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream",
          );

          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadProgress(100);
              resolve();
            } else {
              const responseText = xhr.responseText || xhr.statusText || "Erro desconhecido";
              reject(
                new Error(
                  `Falha ao enviar arquivo para o Wasabi (status ${xhr.status}): ${responseText}`,
                ),
              );
            }
          };

          xhr.onerror = () => {
            const responseText = xhr.responseText || xhr.statusText || "Erro de rede";
            reject(
              new Error(
                `Erro de rede ao enviar arquivo para o Wasabi: ${responseText}`,
              ),
            );
          };

          xhr.send(file);
        });

        return prefix;
      };

      const uploadMultipart = async () => {
        const startRes = await fetch("/api/wasabi/multipart/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titleId: selectedTitleId,
            filename: file.name,
            contentType: file.type,
          }),
        });

        const startData = await startRes.json();
        if (!startRes.ok) {
          throw new Error(startData?.error ?? "Erro ao iniciar upload multipart");
        }

        const { uploadId, key, prefix } = startData as {
          uploadId: string;
          key: string;
          prefix: string;
        };

        const PART_SIZE = 50 * 1024 * 1024;
        const totalSize = file.size;

        const parts: { partNumber: number; start: number; end: number }[] = [];
        let partNumber = 1;
        for (let start = 0; start < totalSize; start += PART_SIZE) {
          const end = Math.min(start + PART_SIZE, totalSize);
          parts.push({ partNumber, start, end });
          partNumber += 1;
        }

        const completedParts: { partNumber: number; eTag: string }[] = [];
        const loadedPerPart = new Map<number, number>();
        let uploadedBytes = 0;

        const uploadPart = async (part: { partNumber: number; start: number; end: number }) => {
          const partRes = await fetch("/api/wasabi/multipart/part-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key,
              uploadId,
              partNumber: part.partNumber,
            }),
          });

          const partData = await partRes.json();
          if (!partRes.ok) {
            throw new Error(partData?.error ?? `Erro ao gerar URL da parte ${part.partNumber}`);
          }

          const { uploadUrl } = partData as { uploadUrl: string };

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", uploadUrl, true);
            xhr.setRequestHeader(
              "Content-Type",
              file.type || "application/octet-stream",
            );

            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) return;
              const previousLoaded = loadedPerPart.get(part.partNumber) ?? 0;
              loadedPerPart.set(part.partNumber, event.loaded);
              uploadedBytes += event.loaded - previousLoaded;
              const percent = Math.round((uploadedBytes / totalSize) * 100);
              setUploadProgress(percent);
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                const eTag = xhr.getResponseHeader("ETag");
                if (!eTag) {
                  reject(
                    new Error(
                      `ETag não retornado pelo Wasabi para a parte ${part.partNumber}`,
                    ),
                  );
                  return;
                }
                completedParts.push({
                  partNumber: part.partNumber,
                  eTag,
                });
                resolve();
              } else {
                const responseText = xhr.responseText || xhr.statusText || "Erro desconhecido";
                reject(
                  new Error(
                    `Falha ao enviar parte ${part.partNumber} para o Wasabi (status ${xhr.status}): ${responseText}`,
                  ),
                );
              }
            };

            xhr.onerror = () => {
              const responseText = xhr.responseText || xhr.statusText || "Erro de rede";
              reject(
                new Error(
                  `Erro de rede ao enviar parte ${part.partNumber} para o Wasabi: ${responseText}`,
                ),
              );
            };

            const blob = file.slice(part.start, part.end);
            xhr.send(blob);
          });
        };

        const queue = [...parts];

        const estimateConcurrency = () => {
          let base = 4;

          if (typeof navigator !== "undefined") {
            const anyNavigator = navigator as any;
            const connection =
              anyNavigator.connection ||
              anyNavigator.mozConnection ||
              anyNavigator.webkitConnection;

            if (connection && typeof connection.downlink === "number") {
              const downlink = connection.downlink as number;
              if (downlink >= 800) {
                base = 16;
              } else if (downlink >= 400) {
                base = 12;
              } else if (downlink >= 100) {
                base = 8;
              } else if (downlink >= 50) {
                base = 6;
              }
            }
          }

          const sizeGb = totalSize / (1024 * 1024 * 1024);
          if (sizeGb >= 50) {
            base = Math.max(base, 16);
          } else if (sizeGb >= 20) {
            base = Math.max(base, 12);
          } else if (sizeGb >= 10) {
            base = Math.max(base, 8);
          }

          return Math.min(Math.max(base, 2), 16);
        };

        const CONCURRENCY = estimateConcurrency();

        const worker = async () => {
          while (true) {
            const next = queue.shift();
            if (!next) break;
            await uploadPart(next);
          }
        };

        const workers = Array.from(
          { length: Math.min(CONCURRENCY, parts.length) },
          () => worker(),
        );

        await Promise.all(workers);

        if (completedParts.length !== parts.length) {
          throw new Error("Nem todas as partes foram enviadas com sucesso.");
        }

        const completeRes = await fetch("/api/wasabi/multipart/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            uploadId,
            parts: completedParts,
          }),
        });

        const completeData = await completeRes.json();
        if (!completeRes.ok) {
          throw new Error(
            completeData?.error ?? "Erro ao finalizar upload multipart no Wasabi",
          );
        }

        setUploadProgress(100);
        return prefix;
      };

      const MIN_MULTIPART_BYTES = 0;

      const prefix =
        file.size > MAX_SINGLE_UPLOAD_BYTES
          ? await uploadMultipart()
          : file.size >= MIN_MULTIPART_BYTES
            ? await uploadMultipart()
            : await uploadSimple();

      await loadTitles();

      setMessage(
        `Upload concluído. Arquivo enviado para o prefixo ${prefix}. O título agora está vinculado a esse caminho HLS.`,
      );
      setFile(null);
    } catch (err: any) {
      setError(err.message ?? "Erro no upload para o Wasabi");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Upload / HLS</h2>
        <p className="text-sm text-zinc-400">
          Envie arquivos de vídeo (ou pastas compactadas com HLS) para o Wasabi e vincule-os a um
          título do catálogo. O caminho HLS fica salvo no próprio título.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm">
        <div className="space-y-1">
          <label className="block text-zinc-200">Título do catálogo</label>
          <select
            value={selectedTitleId}
            onChange={(e) => setSelectedTitleId(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-500"
          >
            <option value="">Selecione um título</option>
            {titles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug}){t.hlsPath ? " – HLS configurado" : ""}
              </option>
            ))}
          </select>
          {loadingTitles && (
            <p className="text-xs text-zinc-500">Carregando títulos...</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-zinc-200">Arquivo de vídeo / HLS</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-zinc-200 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-zinc-900 hover:file:bg-white"
          />
          <p className="text-xs text-zinc-500">
            Você pode enviar um MP4 original ou um pacote HLS (por exemplo, arquivo .zip com
            segments e manifests). O prefixo usado no Wasabi será baseado no slug do título.
          </p>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-70"
        >
          {uploading ? "Enviando..." : "Enviar para Wasabi"}
        </button>
        {uploading && (
          <div className="mt-3 space-y-1">
            <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
              <div
                className="h-2 bg-zinc-100"
                style={{ width: `${uploadProgress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400">
              {uploadProgress !== null
                ? `Enviando arquivo... ${uploadProgress}%`
                : "Preparando upload..."}
            </p>
          </div>
        )}
      </form>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs text-zinc-400">
        <p className="font-semibold text-zinc-200">Como isso se integra ao CRUD:</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            Cada upload gera um caminho no Wasabi do tipo <code>titles/&lt;slug-do-titulo&gt;/</code> e
            atualiza o campo <code>hlsPath</code> do título.
          </li>
          <li>
            Mais tarde, o player HLS e as URLs presignadas vão usar esse mesmo prefixo para montar o
            link do <code>master.m3u8</code>.
          </li>
        </ul>
      </div>
    </div>
  );
}
