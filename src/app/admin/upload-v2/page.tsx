"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ============================================================================
// TYPES
// ============================================================================

type TitleType = "MOVIE" | "SERIES" | "ANIME" | "OTHER";

interface TmdbResult {
  tmdbId: number;
  type: TitleType;
  name: string;
  originalName: string | null;
  overview: string;
  releaseDate: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
}

interface UploadFile {
  id: string;
  file: File;
  seasonNumber?: number;
  episodeNumber?: number;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  uploadSpeed?: number; // bytes per second
  uploadedBytes?: number;
  startTime?: number;
  estimatedTimeLeft?: number; // seconds
}

interface CreatedTitle {
  id: string;
  name: string;
  slug: string;
  type: TitleType;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ============================================================================
// EPISODE DETECTION
// ============================================================================

function detectEpisode(filename: string): { season?: number; episode?: number } | null {
  const patterns = [
    /S(\d+)E(\d+)/i,           // S01E01
    /(\d+)x(\d+)/i,            // 1x01
    /Episode[\s-]?(\d+)/i,     // Episode 01
    /Ep[\s-]?(\d+)/i,          // Ep01
    /\[(\d+)\]/,               // [01]
    /[\s-](\d+)[\s-]/,         // - 01 -
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      if (pattern.source.includes("S(") || pattern.source.includes("(\\d+)x")) {
        // Tem season e episode
        return {
          season: parseInt(match[1], 10),
          episode: parseInt(match[2], 10),
        };
      } else {
        // Só episode
        return {
          episode: parseInt(match[1], 10),
        };
      }
    }
  }

  return null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UploadV2Page() {
  const router = useRouter();

  // TMDB Search
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbResult | null>(null);

  // Created Title
  const [createdTitle, setCreatedTitle] = useState<CreatedTitle | null>(null);
  const [creatingTitle, setCreatingTitle] = useState(false);

  // Files
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Options
  const [autoTranscode, setAutoTranscode] = useState(true);
  const [deleteSource, setDeleteSource] = useState(true);
  const [crf, setCrf] = useState(20);

  // Status
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ============================================================================
  // TMDB SEARCH
  // ============================================================================

  async function handleTmdbSearch(e: FormEvent) {
    e.preventDefault();
    if (!tmdbQuery.trim()) return;

    setTmdbLoading(true);
    setError(null);
    try {
      const url = new URL("/api/tmdb/search", window.location.origin);
      url.searchParams.set("q", tmdbQuery.trim());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao consultar TMDb");
      }
      setTmdbResults(data.results ?? []);
    } catch (err: any) {
      setError(err.message ?? "Erro ao consultar TMDb");
    } finally {
      setTmdbLoading(false);
    }
  }

  function selectTmdbResult(result: TmdbResult) {
    setSelectedTmdb(result);
    setTmdbResults([]);
    setTmdbQuery("");
  }

  // ============================================================================
  // CREATE TITLE
  // ============================================================================

  async function createTitle() {
    if (!selectedTmdb) return;

    setCreatingTitle(true);
    setError(null);
    try {
      // Primeiro, verifica se já existe
      const checkRes = await fetch("/api/titles");
      const allTitles = await checkRes.json();
      
      const existing = allTitles.find(
        (t: any) => t.tmdbId === selectedTmdb.tmdbId
      );

      if (existing) {
        // Título já existe!
        setCreatedTitle({
          id: existing.id,
          name: existing.name,
          slug: existing.slug,
          type: existing.type,
        });
        setInfo(
          `ℹ️ Título "${existing.name}" já existe no catálogo! Você pode fazer upload de mais arquivos para ele.`
        );
        
        // Se for série/anime, criar episódios automaticamente se detectados
        if ((existing.type === "SERIES" || existing.type === "ANIME") && uploadFiles.length > 0) {
          await createEpisodesFromFiles(existing.id);
        }
        
        setCreatingTitle(false);
        return;
      }

      // Se não existe, cria novo
      const res = await fetch("/api/titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: selectedTmdb.tmdbId,
          type: selectedTmdb.type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao criar título");
      }

      setCreatedTitle({
        id: data.id,
        name: data.name,
        slug: data.slug,
        type: data.type,
      });
      setInfo(`✅ Título "${data.name}" criado com sucesso!`);
      
      // Se for série/anime, criar episódios automaticamente se detectados
      if ((data.type === "SERIES" || data.type === "ANIME") && uploadFiles.length > 0) {
        await createEpisodesFromFiles(data.id);
      }
    } catch (err: any) {
      setError(err.message ?? "Erro ao criar título");
    } finally {
      setCreatingTitle(false);
    }
  }

  async function createEpisodesFromFiles(titleId: string) {
    // Agrupar por temporada
    const episodesBySeason = new Map<number, Array<{ episodeNumber: number; name: string }>>();
    
    uploadFiles.forEach((file) => {
      if (file.seasonNumber && file.episodeNumber) {
        const season = file.seasonNumber;
        if (!episodesBySeason.has(season)) {
          episodesBySeason.set(season, []);
        }
        episodesBySeason.get(season)!.push({
          episodeNumber: file.episodeNumber,
          name: `Episódio ${file.episodeNumber}`,
        });
      }
    });

    // Criar episódios para cada temporada
    for (const [seasonNumber, episodes] of episodesBySeason.entries()) {
      try {
        await fetch("/api/admin/episodes/create-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titleId,
            seasonNumber,
            episodes,
          }),
        });
      } catch (err) {
        console.error(`Erro ao criar episódios da temporada ${seasonNumber}:`, err);
      }
    }
  }

  // ============================================================================
  // FILE HANDLING
  // ============================================================================

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addFiles(files);
  }, []);

  function addFiles(files: File[]) {
    const newFiles: UploadFile[] = files.map((file) => {
      const detected = detectEpisode(file.name);
      return {
        id: Math.random().toString(36).substring(7),
        file,
        seasonNumber: detected?.season,
        episodeNumber: detected?.episode,
        progress: 0,
        status: "pending",
      };
    });

    setUploadFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(id: string) {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id));
  }

  // ============================================================================
  // UPLOAD
  // ============================================================================

  async function startUpload() {
    if (!createdTitle) {
      setError("Crie um título antes de fazer upload!");
      return;
    }

    if (uploadFiles.length === 0) {
      setError("Adicione pelo menos um arquivo!");
      return;
    }

    setError(null);
    setInfo("🚀 Iniciando uploads...");

    for (const uploadFile of uploadFiles) {
      await uploadSingleFile(uploadFile);
    }

    setInfo("✅ Todos os uploads concluídos!");

    if (autoTranscode) {
      setInfo("🎬 Iniciando transcodificação automática...");
      await startTranscoding();
    }
  }

  async function uploadSingleFile(uploadFile: UploadFile) {
    try {
      // Update status
      const startTime = Date.now();
      setUploadFiles((prev) =>
        prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "uploading", startTime } : f))
      );

      // Get upload URL
      const res = await fetch("/api/wasabi/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId: createdTitle!.id,
          episodeId: undefined, // TODO: criar episódio se for série
          filename: uploadFile.file.name,
          contentType: uploadFile.file.type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao gerar URL de upload");
      }

      const { uploadUrl } = data;

      // Upload file
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", uploadFile.file.type || "application/octet-stream");

        let lastLoaded = 0;
        let lastTime = Date.now();

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000; // seconds
          const bytesDiff = event.loaded - lastLoaded;
          
          // Calculate speed (bytes per second)
          const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
          
          // Calculate estimated time left
          const remainingBytes = event.total - event.loaded;
          const estimatedTimeLeft = speed > 0 ? remainingBytes / speed : 0;
          
          const percent = Math.round((event.loaded / event.total) * 100);
          
          setUploadFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    progress: percent,
                    uploadSpeed: speed,
                    uploadedBytes: event.loaded,
                    estimatedTimeLeft,
                  }
                : f
            )
          );
          
          lastLoaded = event.loaded;
          lastTime = now;
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id ? { ...f, status: "completed", progress: 100 } : f
              )
            );
            resolve();
          } else {
            reject(new Error(`Upload falhou: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Erro de rede"));
        xhr.send(uploadFile.file);
      });
    } catch (err: any) {
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "error", error: err.message }
            : f
        )
      );
    }
  }

  async function startTranscoding() {
    if (!createdTitle) return;

    try {
      const res = await fetch(`/api/transcode/hls/${createdTitle.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crf,
          deleteSource,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao iniciar transcodificação");
      }

      setInfo(`✅ Transcodificação iniciada! Job ID: ${data.jobId}`);
    } catch (err: any) {
      setError(err.message ?? "Erro ao iniciar transcodificação");
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-semibold">🚀 Upload Unificado</h2>
        <p className="text-zinc-400 text-sm">
          Busque no TMDB, arraste arquivos e pronto! Tudo automatizado.
        </p>
      </div>

      {/* Error/Info Messages */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/60 p-4 text-red-300 text-sm">
          ❌ {error}
        </div>
      )}
      {info && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/60 p-4 text-emerald-300 text-sm">
          {info}
        </div>
      )}

      {/* Step 1: TMDB Search */}
      {!selectedTmdb && !createdTitle && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">1️⃣ Buscar no TMDB</h3>
            <p className="text-zinc-400 text-sm">Digite o nome do filme ou série</p>
          </div>

          <form onSubmit={handleTmdbSearch} className="flex gap-2">
            <input
              type="text"
              value={tmdbQuery}
              onChange={(e) => setTmdbQuery(e.target.value)}
              placeholder="Ex: Breaking Bad, Inception..."
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
            <button
              type="submit"
              disabled={tmdbLoading}
              className="rounded-md bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {tmdbLoading ? "Buscando..." : "🔍 Buscar"}
            </button>
          </form>

          {/* Results */}
          {tmdbResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-400">{tmdbResults.length} resultados encontrados:</p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tmdbResults.map((result) => (
                  <button
                    key={result.tmdbId}
                    onClick={() => selectTmdbResult(result)}
                    className="w-full flex items-start gap-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-left hover:border-emerald-600 hover:bg-zinc-800"
                  >
                    {result.posterUrl && (
                      <img
                        src={result.posterUrl}
                        alt={result.name}
                        className="w-16 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-zinc-100">{result.name}</p>
                      {result.originalName && result.originalName !== result.name && (
                        <p className="text-sm text-zinc-400">{result.originalName}</p>
                      )}
                      <p className="text-xs text-zinc-500 mt-1">
                        {result.type} • {result.releaseDate?.substring(0, 4) || "N/A"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Selected Title */}
      {selectedTmdb && !createdTitle && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">2️⃣ Título Selecionado</h3>
            <p className="text-zinc-400 text-sm">Confirme e crie o título no catálogo</p>
          </div>

          <div className="flex items-start gap-4">
            {selectedTmdb.posterUrl && (
              <img
                src={selectedTmdb.posterUrl}
                alt={selectedTmdb.name}
                className="w-24 h-36 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <p className="text-xl font-semibold text-zinc-100">{selectedTmdb.name}</p>
              {selectedTmdb.originalName && (
                <p className="text-sm text-zinc-400">{selectedTmdb.originalName}</p>
              )}
              <p className="text-sm text-zinc-500 mt-2">
                {selectedTmdb.type} • {selectedTmdb.releaseDate?.substring(0, 4) || "N/A"}
              </p>
              <p className="text-sm text-zinc-400 mt-2 line-clamp-3">{selectedTmdb.overview}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={createTitle}
              disabled={creatingTitle}
              className="rounded-md bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {creatingTitle ? "Criando..." : "✅ Criar Título"}
            </button>
            <button
              onClick={() => setSelectedTmdb(null)}
              className="rounded-md border border-zinc-700 px-6 py-2 font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              ← Voltar
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Upload Files */}
      {createdTitle && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">3️⃣ Adicionar Arquivos</h3>
            <p className="text-zinc-400 text-sm">
              Arraste arquivos ou clique para selecionar
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-zinc-400">Título:</span>
              <span className="font-semibold text-emerald-400">{createdTitle.name}</span>
              <a
                href="/admin/catalog"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Ver no catálogo →
              </a>
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? "border-emerald-600 bg-emerald-950/20"
                : "border-zinc-700 bg-zinc-900/50"
            }`}
          >
            <input
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileInput}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <div className="text-4xl mb-4">📁</div>
              <p className="text-lg font-semibold text-zinc-100 mb-2">
                Arraste arquivos aqui ou clique para selecionar
              </p>
              <p className="text-sm text-zinc-400">
                Aceita: .mkv, .mp4, .avi, .mov, .webm
              </p>
            </label>
          </div>

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-300">
                {uploadFiles.length} arquivo(s) selecionado(s):
              </p>
              {uploadFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-zinc-100">{f.file.name}</p>
                    <p className="text-xs text-zinc-500">
                      {formatBytes(f.file.size)}
                      {f.seasonNumber && f.episodeNumber && (
                        <span className="ml-2 text-emerald-400">
                          • Detectado: S{f.seasonNumber.toString().padStart(2, "0")}E
                          {f.episodeNumber.toString().padStart(2, "0")}
                        </span>
                      )}
                    </p>
                    {f.status === "uploading" && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">
                            {f.uploadedBytes && formatBytes(f.uploadedBytes)} / {formatBytes(f.file.size)}
                          </span>
                          <span className="text-emerald-400 font-mono">
                            {f.uploadSpeed && formatSpeed(f.uploadSpeed)}
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 transition-all"
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">{f.progress}%</span>
                          {f.estimatedTimeLeft && f.estimatedTimeLeft > 0 && (
                            <span className="text-zinc-500">
                              ~{formatTime(f.estimatedTimeLeft)} restante
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {f.status === "completed" && (
                      <p className="text-xs text-emerald-400 mt-1">✅ Upload concluído!</p>
                    )}
                    {f.status === "error" && (
                      <p className="text-xs text-red-400 mt-1">❌ {f.error}</p>
                    )}
                  </div>
                  {f.status === "pending" && (
                    <button
                      onClick={() => removeFile(f.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Options */}
          <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
            <p className="text-sm font-semibold text-zinc-300">⚙️ Opções</p>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={autoTranscode}
                onChange={(e) => setAutoTranscode(e.target.checked)}
                className="rounded"
              />
              Transcodificar automaticamente após upload
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={deleteSource}
                onChange={(e) => setDeleteSource(e.target.checked)}
                className="rounded"
              />
              Deletar arquivo original após transcodificação
            </label>
            <div className="flex items-center gap-4">
              <label className="text-sm text-zinc-300">CRF (qualidade):</label>
              <input
                type="range"
                min="16"
                max="30"
                value={crf}
                onChange={(e) => setCrf(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono text-zinc-400">{crf}</span>
            </div>
          </div>

          {/* Upload Button */}
          <button
            onClick={startUpload}
            disabled={uploadFiles.length === 0 || uploadFiles.some((f) => f.status === "uploading")}
            className="w-full rounded-md bg-emerald-600 px-6 py-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            🚀 Fazer Upload e Processar Tudo
          </button>
        </div>
      )}
    </div>
  );
}
