"use client";

import { QueuedUpload } from "@/hooks/useUploadQueue";

interface UploadQueuePanelProps {
  queue: QueuedUpload[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onClearCompleted: () => void;
}

export default function UploadQueuePanel({
  queue,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onClearCompleted,
}: UploadQueuePanelProps) {
  if (queue.length === 0) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatTime = (seconds: number) => {
    if (seconds === 0 || !isFinite(seconds)) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const completedCount = queue.filter((u) => u.status === "completed").length;

  return (
    <div className="fixed bottom-6 right-6 z-40 w-96 rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">
            📤 Fila de Upload ({queue.length})
          </h3>
          {completedCount > 0 && (
            <button
              onClick={onClearCompleted}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              Limpar concluídos
            </button>
          )}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto p-2 space-y-2">
        {queue.map((upload) => (
          <div
            key={upload.id}
            className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-100 truncate">
                  {upload.file.name}
                </p>
                <p className="text-[10px] text-zinc-500">{upload.titleName}</p>
              </div>
              <div className="flex gap-1 ml-2">
                {upload.status === "uploading" && (
                  <button
                    onClick={() => onPause(upload.id)}
                    className="rounded px-2 py-1 text-[10px] text-yellow-400 hover:bg-yellow-900/20"
                    title="Pausar"
                  >
                    ⏸
                  </button>
                )}
                {upload.status === "paused" && (
                  <button
                    onClick={() => onResume(upload.id)}
                    className="rounded px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-900/20"
                    title="Retomar"
                  >
                    ▶️
                  </button>
                )}
                {upload.status === "error" && (
                  <button
                    onClick={() => onRetry(upload.id)}
                    className="rounded px-2 py-1 text-[10px] text-blue-400 hover:bg-blue-900/20"
                    title="Tentar novamente"
                  >
                    🔄
                  </button>
                )}
                {upload.status !== "completed" && (
                  <button
                    onClick={() => onCancel(upload.id)}
                    className="rounded px-2 py-1 text-[10px] text-red-400 hover:bg-red-900/20"
                    title="Cancelar"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    upload.status === "completed"
                      ? "bg-emerald-600"
                      : upload.status === "error"
                      ? "bg-red-600"
                      : upload.status === "paused"
                      ? "bg-yellow-600"
                      : "bg-blue-600"
                  }`}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            </div>

            {/* Status Info */}
            <div className="flex items-center justify-between text-[10px]">
              <span
                className={`font-semibold ${
                  upload.status === "completed"
                    ? "text-emerald-400"
                    : upload.status === "error"
                    ? "text-red-400"
                    : upload.status === "paused"
                    ? "text-yellow-400"
                    : upload.status === "uploading"
                    ? "text-blue-400"
                    : "text-zinc-500"
                }`}
              >
                {upload.status === "completed" && "✅ Concluído"}
                {upload.status === "error" && `❌ ${upload.error || "Erro"}`}
                {upload.status === "paused" && "⏸ Pausado"}
                {upload.status === "uploading" && `📤 ${Math.round(upload.progress)}%`}
                {upload.status === "pending" && "⏳ Aguardando"}
              </span>

              {upload.status === "uploading" && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>{formatSpeed(upload.uploadSpeed)}</span>
                  <span>•</span>
                  <span>{formatTime(upload.estimatedTimeLeft)}</span>
                </div>
              )}

              {(upload.status === "completed" || upload.status === "uploading") && (
                <span className="text-zinc-500">
                  {formatBytes(upload.uploadedBytes)} / {formatBytes(upload.totalBytes)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
