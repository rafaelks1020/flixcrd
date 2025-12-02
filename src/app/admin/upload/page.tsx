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

      // 1) Solicita URL de upload para Wasabi
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

      // 2) Envia o arquivo direto para o Wasabi usando a presigned URL
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error("Falha ao enviar arquivo para o Wasabi");
      }

      // 3) Recarrega os títulos para refletir hlsPath atualizado
      await loadTitles();

      setMessage(
        `Upload concluído. Arquivo enviado para o prefixo ${prefix}. O título agora está vinculado a esse caminho HLS.`,
      );
      setFile(null);
    } catch (err: any) {
      setError(err.message ?? "Erro no upload para o Wasabi");
    } finally {
      setUploading(false);
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
