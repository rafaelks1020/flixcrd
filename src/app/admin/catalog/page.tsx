"use client";

import { FormEvent, useEffect, useState } from "react";

type TitleType = "MOVIE" | "SERIES" | "ANIME" | "OTHER";

interface Title {
  id: string;
  tmdbId: number | null;
  type: TitleType;
  slug: string;
  name: string;
  originalName: string | null;
  overview: string | null;
  releaseDate: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  hlsPath: string | null;
}

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

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCatalogPage() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [transcodingId, setTranscodingId] = useState<string | null>(null);
  const [transcodingProgress, setTranscodingProgress] = useState<number | null>(null);
  const [transcodingStatus, setTranscodingStatus] = useState<string | null>(null);

  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    tmdbId: "",
    type: "MOVIE" as TitleType,
    name: "",
    slug: "",
    originalName: "",
    overview: "",
    releaseDate: "",
    posterUrl: "",
    backdropUrl: "",
    hlsPath: "",
  });

  async function loadTitles() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/titles");
      if (!res.ok) {
        throw new Error("Erro ao carregar títulos");
      }
      const data = await res.json();
      setTitles(data);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar títulos");
    } finally {
      setLoading(false);
    }
  }

  async function handleTranscode(id: string) {
    setError(null);
    setInfo(null);
    setTranscodingId(id);
    setTranscodingProgress(null);
    setTranscodingStatus(null);
    try {
      const res = await fetch(`/api/transcode/hls/${id}`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao gerar HLS para este título");
      }
      const jobId: string | undefined = data?.jobId;
      if (!jobId) {
        throw new Error("Serviço de transcodificação não retornou jobId.");
      }

      // Polling de status
      const poll = async () => {
        try {
          const statusRes = await fetch(
            `/api/transcode/hls/${id}?job_id=${encodeURIComponent(jobId)}`,
          );
          const statusData = await statusRes.json();

          if (!statusRes.ok) {
            throw new Error(statusData?.error ?? "Erro ao consultar status do job");
          }

          const status: string = statusData.status ?? "";
          const progress: number =
            typeof statusData.progress === "number" ? statusData.progress : 0;
          const message: string | null = statusData.message ?? null;

          setTranscodingStatus(status);
          setTranscodingProgress(progress);

          if (status === "completed") {
            await loadTitles();
            setInfo("Transcodificação HLS concluída. Arquivos gerados no prefixo do título.");
            setTranscodingId(null);
            setTranscodingProgress(null);
            setTranscodingStatus(null);
            return false;
          }

          if (status === "error") {
            setError(
              message || "Job de transcodificação falhou. Verifique os logs do transcoder.",
            );
            setTranscodingId(null);
            setTranscodingProgress(null);
            setTranscodingStatus(null);
            return false;
          }

          return true;
        } catch (err: any) {
          setError(err.message ?? "Erro ao consultar status do job");
          setTranscodingId(null);
          setTranscodingProgress(null);
          setTranscodingStatus(null);
          return false;
        }
      };

      // Primeiro poll imediato
      let keepPolling = await poll();
      if (keepPolling) {
        const interval = setInterval(async () => {
          const cont = await poll();
          if (!cont) {
            clearInterval(interval);
          }
        }, 5000);
      }
    } catch (err: any) {
      setError(err.message ?? "Erro ao iniciar transcodificação HLS");
    } finally {
      // o estado é finalizado no próprio polling
    }
  }

  useEffect(() => {
    loadTitles();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({
      tmdbId: "",
      type: "MOVIE",
      name: "",
      slug: "",
      originalName: "",
      overview: "",
      releaseDate: "",
      posterUrl: "",
      backdropUrl: "",
      hlsPath: "",
    });
    setTmdbResults([]);
  }

  function applyTmdbResult(result: TmdbResult) {
    setForm((prev) => ({
      ...prev,
      tmdbId: String(result.tmdbId),
      type: result.type,
      name: result.name,
      slug: prev.slug || slugify(result.name),
      originalName: result.originalName ?? "",
      overview: result.overview ?? "",
      releaseDate: result.releaseDate ?? "",
      posterUrl: result.posterUrl ?? "",
      backdropUrl: result.backdropUrl ?? "",
    }));
  }

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const payload: any = {
        tmdbId: form.tmdbId ? Number(form.tmdbId) : null,
        type: form.type,
        slug: form.slug || slugify(form.name),
        name: form.name,
        originalName: form.originalName || null,
        overview: form.overview || null,
        releaseDate: form.releaseDate || null,
        posterUrl: form.posterUrl || null,
        backdropUrl: form.backdropUrl || null,
        hlsPath: form.hlsPath || null,
      };

      const url = editingId ? `/api/titles/${editingId}` : "/api/titles";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao salvar título");
      }

      await loadTitles();
      resetForm();
    } catch (err: any) {
      setError(err.message ?? "Erro ao salvar título");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(title: Title) {
    setEditingId(title.id);
    setForm({
      tmdbId: title.tmdbId ? String(title.tmdbId) : "",
      type: title.type,
      name: title.name,
      slug: title.slug,
      originalName: title.originalName ?? "",
      overview: title.overview ?? "",
      releaseDate: title.releaseDate ? title.releaseDate.slice(0, 10) : "",
      posterUrl: title.posterUrl ?? "",
      backdropUrl: title.backdropUrl ?? "",
      hlsPath: title.hlsPath ?? "",
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este título?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/titles/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao excluir título");
      }
      await loadTitles();
      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err.message ?? "Erro ao excluir título");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Catálogo</h2>
        <p className="text-sm text-zinc-400">
          Gerencie os títulos do catálogo e use a busca TMDb para preencher metadados automaticamente.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {info}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Buscar no TMDb</h3>
          <form onSubmit={handleTmdbSearch} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nome do filme ou série"
                value={tmdbQuery}
                onChange={(e) => setTmdbQuery(e.target.value)}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-500"
              />
              <button
                type="submit"
                disabled={tmdbLoading}
                className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-70"
              >
                {tmdbLoading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </form>

          {tmdbResults.length > 0 && (
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/60 p-2 text-xs">
              {tmdbResults.map((r) => (
                <button
                  key={`${r.type}-${r.tmdbId}`}
                  type="button"
                  onClick={() => applyTmdbResult(r)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left hover:bg-zinc-800/80"
                >
                  {r.posterUrl && (
                    <img
                      src={r.posterUrl}
                      alt={r.name}
                      className="h-16 w-11 flex-shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 flex items-start justify-between gap-2">
                    <span>
                      <span className="font-medium text-zinc-50">{r.name}</span>
                      {r.releaseDate && (
                        <span className="ml-1 text-zinc-400">
                          ({r.releaseDate.slice(0, 4)})
                        </span>
                      )}
                      <span className="block text-[10px] uppercase text-zinc-500">
                        {r.type === "MOVIE" ? "Filme" : "Série"}
                      </span>
                    </span>
                    <span className="text-[10px] text-zinc-500">TMDb #{r.tmdbId}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-zinc-800 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">
              {editingId ? "Editar título" : "Novo título"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-zinc-300">TMDb ID</label>
                  <input
                    type="text"
                    value={form.tmdbId}
                    onChange={(e) => setForm({ ...form, tmdbId: e.target.value })}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-zinc-300">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as TitleType })
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                  >
                    <option value="MOVIE">Filme</option>
                    <option value="SERIES">Série</option>
                    <option value="ANIME">Anime</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-zinc-300">Nome</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug: form.slug || slugify(e.target.value),
                    })
                  }
                  required
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-zinc-300">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-zinc-300">Nome original</label>
                  <input
                    type="text"
                    value={form.originalName}
                    onChange={(e) =>
                      setForm({ ...form, originalName: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-zinc-300">Data de lançamento</label>
                  <input
                    type="date"
                    value={form.releaseDate}
                    onChange={(e) =>
                      setForm({ ...form, releaseDate: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-zinc-300">Sinopse</label>
                <textarea
                  rows={3}
                  value={form.overview}
                  onChange={(e) => setForm({ ...form, overview: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-zinc-300">Poster URL</label>
                <input
                  type="text"
                  value={form.posterUrl}
                  onChange={(e) => setForm({ ...form, posterUrl: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                />
                {form.posterUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={form.posterUrl}
                      alt={form.name || "Poster"}
                      className="h-24 w-16 rounded border border-zinc-800 object-cover"
                    />
                    <span className="text-[10px] text-zinc-500">
                      Pré-visualização do poster
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-zinc-300">Backdrop URL</label>
                <input
                  type="text"
                  value={form.backdropUrl}
                  onChange={(e) => setForm({ ...form, backdropUrl: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                />
                {form.backdropUrl && (
                  <div className="mt-2 flex flex-col gap-1">
                    <img
                      src={form.backdropUrl}
                      alt={form.name || "Backdrop"}
                      className="h-20 w-full rounded border border-zinc-800 object-cover"
                    />
                    <span className="text-[10px] text-zinc-500">
                      Pré-visualização do backdrop
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-zinc-300">Caminho HLS (Wasabi)</label>
                <input
                  type="text"
                  placeholder="ex: movie-id/"
                  value={form.hlsPath}
                  onChange={(e) => setForm({ ...form, hlsPath: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-50 outline-none focus:border-zinc-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-70"
                >
                  {saving
                    ? editingId
                      ? "Salvando..."
                      : "Criando..."
                    : editingId
                    ? "Salvar alterações"
                    : "Criar título"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Títulos cadastrados</h3>
            {loading && (
              <span className="text-[10px] text-zinc-500">Carregando...</span>
            )}
          </div>
          {titles.length === 0 && !loading ? (
            <p className="text-zinc-500 text-xs">
              Nenhum título cadastrado ainda. Use o formulário ao lado para criar o primeiro.
            </p>
          ) : (
            <div className="max-h-[520px] overflow-y-auto rounded-md border border-zinc-800">
              <table className="w-full border-collapse text-left">
                <thead className="bg-zinc-900 text-[11px] uppercase text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Slug</th>
                    <th className="px-3 py-2">TMDb</th>
                    <th className="px-3 py-2">HLS</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                  {titles.map((t) => (
                    <tr key={t.id} className="align-top text-[11px]">
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-100">{t.name}</div>
                        {t.releaseDate && (
                          <div className="text-[10px] text-zinc-500">
                            {t.releaseDate.slice(0, 10)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{t.type}</td>
                      <td className="px-3 py-2 text-zinc-400">{t.slug}</td>
                      <td className="px-3 py-2 text-zinc-400">
                        {t.tmdbId ? `#${t.tmdbId}` : "-"}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {t.hlsPath ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTranscode(t.id)}
                            disabled={transcodingId === t.id}
                            className="rounded-md border border-emerald-700 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-900/60 disabled:opacity-60"
                          >
                            {transcodingId === t.id
                              ? transcodingStatus === "running" && transcodingProgress !== null
                                ? `Gerando HLS... ${Math.round(transcodingProgress)}%`
                                : "Gerando HLS..."
                              : "Gerar HLS"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id)}
                            className="rounded-md border border-red-700 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900/60"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
