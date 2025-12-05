import { useState, useCallback } from "react";

export interface QueuedUpload {
  id: string;
  file: File;
  titleId: string;
  titleName: string;
  status: "pending" | "uploading" | "paused" | "completed" | "error";
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  uploadSpeed: number;
  estimatedTimeLeft: number;
  error?: string;
  xhr?: XMLHttpRequest;
}

export function useUploadQueue() {
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addToQueue = useCallback((uploads: Omit<QueuedUpload, "id" | "status" | "progress" | "uploadedBytes" | "totalBytes" | "uploadSpeed" | "estimatedTimeLeft">[]) => {
    const newUploads: QueuedUpload[] = uploads.map((upload) => ({
      ...upload,
      id: Math.random().toString(36).substring(7),
      status: "pending" as const,
      progress: 0,
      uploadedBytes: 0,
      totalBytes: upload.file.size,
      uploadSpeed: 0,
      estimatedTimeLeft: 0,
    }));

    setQueue((prev) => [...prev, ...newUploads]);
    return newUploads;
  }, []);

  const pauseUpload = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === id && item.status === "uploading") {
          item.xhr?.abort();
          return { ...item, status: "paused" as const };
        }
        return item;
      })
    );
  }, []);

  const resumeUpload = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === id && item.status === "paused") {
          return { ...item, status: "pending" as const };
        }
        return item;
      })
    );
  }, []);

  const cancelUpload = useCallback((id: string) => {
    setQueue((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item?.xhr) {
        item.xhr.abort();
      }
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const retryUpload = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === id && item.status === "error") {
          return {
            ...item,
            status: "pending" as const,
            progress: 0,
            uploadedBytes: 0,
            error: undefined,
          };
        }
        return item;
      })
    );
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((item) => item.status !== "completed"));
  }, []);

  const updateUpload = useCallback((id: string, updates: Partial<QueuedUpload>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  return {
    queue,
    isProcessing,
    setIsProcessing,
    addToQueue,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    clearCompleted,
    updateUpload,
  };
}
