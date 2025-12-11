"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type TitleType = "MOVIE" | "SERIES" | "ANIME" | "OTHER";

interface EpisodeSummary {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string | null;
  airDate: string | null;
  runtime: number | null;
  stillUrl: string | null;
  hlsPath: string | null;
}

interface SeasonSummary {
  id: string;
  seasonNumber: number;
  name: string | null;
  overview: string | null;
  airDate: string | null;
  posterUrl: string | null;
  episodeCount: number | null;
  episodes: EpisodeSummary[];
}

interface TitleSeasonsResponse {
  id: string;
  name: string;
  slug: string;
  type: TitleType;
  tmdbId: number | null;
  seasons: SeasonSummary[];
}

interface SeasonsClientProps {
  titleId: string;
}

type EpisodeHlsStatus = "none" | "uploaded" | "hls_ready" | "error";

export default function SeasonsClient({ titleId }: SeasonsClientProps) {
  const [data, setData] = useState<TitleSeasonsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [importingAll, setImportingAll] = useState(false);
  const [importingSeason, setImportingSeason] = useState<number | null>(null);
  const [seasonInput, setSeasonInput] = useState(1);
  const [episodeHlsStatus, setEpisodeHlsStatus] = useState<Record<string, EpisodeHlsStatus>>({});
  const [bulkTranscoding, setBulkTranscoding] = useState(false);
  const [showOnlyNoUpload, setShowOnlyNoUpload] = useState(false);
  const [episodeUploadTarget, setEpisodeUploadTarget] = useState<EpisodeSummary | null>(null);
  const [episodeUploadBusy, setEpisodeUploadBusy] = useState(false);
  const episodeUploadInputRef = useRef<HTMLInputElement | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/titles/${titleId}/seasons`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Erro ao carregar temporadas/episódios.");
      }
      setData(json as TitleSeasonsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar temporadas/episódios.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTranscodeAllEpisodes() {
    if (!data) return;
    setError(null);
    setInfo(null);
    setBulkTranscoding(true);
    try {
      const res = await fetch(`/api/admin/titles/${titleId}/transcode-episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crf: 20,
          deleteSource: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Erro ao enfileirar HLS para episódios.");
      }

      const queued = Array.isArray(json?.queued) ? json.queued.length : 0;
      const skipped = Array.isArray(json?.skipped) ? json.skipped.length : 0;
      const errors = Array.isArray(json?.errors) ? json.errors.length : 0;

      const parts: string[] = [];
      parts.push(`Enfileirados ${queued} episódio(s) para HLS.`);
      if (skipped > 0) parts.push(`${skipped} ignorado(s) sem arquivo de origem.`);
      if (errors > 0) parts.push(`${errors} com erro ao criar job (veja logs do transcoder).`);

      setInfo(parts.join(" "));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enfileirar HLS para episódios.");
    } finally {
      setBulkTranscoding(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleId]);

  useEffect(() => {
    async function loadEpisodeHlsStatus() {
      if (!data) return;

      const allEpisodes = data.seasons.flatMap((season) => season.episodes);
      const uniqueIds = Array.from(new Set(allEpisodes.map((ep) => ep.id)));
      if (uniqueIds.length === 0) return;

      try {
        const entries = await Promise.all(
          uniqueIds.map(async (id) => {
            try {
              const res = await fetch(`/api/admin/episodes/${id}/hls-status`);
              if (!res.ok) {
                return [id, "error" as EpisodeHlsStatus] as const;
              }
              const json = await res.json();
              const status = (json?.status as EpisodeHlsStatus) ?? "none";
              return [id, status] as const;
            } catch {
              return [id, "error" as EpisodeHlsStatus] as const;
            }
          }),
        );

        const map: Record<string, EpisodeHlsStatus> = {};
        for (const [id, status] of entries) {
          map[id] = status;
        }
        setEpisodeHlsStatus(map);
      } catch {
        // ignora erros globais, status ficará vazio
      }
    }

     
    loadEpisodeHlsStatus();
  }, [data]);

  async function handleImportAll() {
    if (!data?.tmdbId) {
      setError("Título não possui tmdbId configurado.");
      return;
    }
    setError(null);
    setInfo(null);
    setImportingAll(true);
    try {
      const res = await fetch(`/api/admin/titles/${titleId}/import-all-seasons`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Erro ao importar todas as temporadas.");
      }
      const imported = Array.isArray(json.imported) ? json.imported.length : 0;
      setInfo(
        `Importação concluída: ${imported} temporada(s) importada(s) de ${json.seasonsFound ?? imported}.`,
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar todas as temporadas.");
    } finally {
      setImportingAll(false);
    }
  }

  async function handleImportSeason(seasonNumber: number) {
    if (!Number.isFinite(seasonNumber) || seasonNumber <= 0) return;
    setError(null);
    setInfo(null);
    setImportingSeason(seasonNumber);
    try {
      const res = await fetch(`/api/admin/titles/${titleId}/import-season`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonNumber }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Erro ao importar temporada.");
      }
      const total = json?.episodes?.total ?? 0;
      setInfo(`Temporada ${seasonNumber} importada com ${total} episódio(s).`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar temporada.");
    } finally {
      setImportingSeason(null);
    }
  }

  const isSeries = data && (data.type === "SERIES" || data.type === "ANIME");
  const seasons = data?.seasons ?? [];

  const filteredSeasons = seasons
    .map((season) => {
      if (!showOnlyNoUpload) return season;

      const filteredEpisodes = season.episodes.filter((ep) => {
        const status = episodeHlsStatus[ep.id] ?? "none";
        return status === "none";
      });

      return {
        ...season,
        episodes: filteredEpisodes,
      };
    })
    .filter((season) => {
      if (!showOnlyNoUpload) return true;
      return season.episodes.length > 0;
    });

  function handleEpisodeUploadClick(ep: EpisodeSummary) {
    if (episodeUploadBusy) return;
    setEpisodeUploadTarget(ep);
    if (episodeUploadInputRef.current) {
      episodeUploadInputRef.current.value = "";
      episodeUploadInputRef.current.click();
    }
  }

  async function handleEpisodeUploadFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (!data || !episodeUploadTarget) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setEpisodeUploadBusy(true);
      setError(null);
      setInfo(null);

      const res = await fetch("/api/wasabi/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId: data.id,
          episodeId: episodeUploadTarget.id,
          filename: file.name,
          contentType: file.type,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Erro ao gerar URL de upload");
      }

      const { uploadUrl } = json as { uploadUrl: string };

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Upload falhou: ${putRes.status}`);
      }

      setInfo(
        `Upload concluído para S${episodeUploadTarget.seasonNumber
          .toString()
          .padStart(2, "0")}E${episodeUploadTarget.episodeNumber
          .toString()
          .padStart(2, "0")}.`,
      );
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao fazer upload do episódio.",
      );
    } finally {
      setEpisodeUploadBusy(false);
      setEpisodeUploadTarget(null);
      if (episodeUploadInputRef.current) {
        episodeUploadInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={episodeUploadInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleEpisodeUploadFileChange}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-zinc-400">
            <Link
              href="/admin/catalog"
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100"
            >
              <span>←</span>
              <span>Voltar para o catálogo</span>
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-zinc-50">
            {data ? data.name : "Carregando título..."}
          </h1>
          {data && (
            <p className="text-xs text-zinc-400">
              {data.type} · slug: <span className="font-mono text-zinc-300">{data.slug}</span>
              {typeof data.tmdbId === "number" && (
                <span className="ml-2">TMDb: #{data.tmdbId}</span>
              )}
            </p>
          )}
        </div>
        {isSeries && (
          <div className="flex flex-col items-end gap-2 text-[11px]">
            <button
              type="button"
              onClick={handleImportAll}
              disabled={importingAll}
              className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-60"
            >
              {importingAll ? "Importando todas as temporadas..." : "Importar todas as temporadas"}
            </button>
            <div className="flex items-center gap-2">
              <label className="text-zinc-300">Temporada</label>
              <input
                type="number"
                min={1}
                value={seasonInput}
                onChange={(e) => setSeasonInput(Number(e.target.value) || 1)}
                className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-50 outline-none focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={() => handleImportSeason(seasonInput)}
                disabled={importingSeason !== null}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800 disabled:opacity-60"
              >
                {importingSeason !== null
                  ? `Importando T${importingSeason.toString().padStart(2, "0")}...`
                  : "Importar temporada"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleTranscodeAllEpisodes}
              disabled={bulkTranscoding}
              className="mt-1 rounded-md border border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
            >
              {bulkTranscoding
                ? "Enfileirando HLS de episódios..."
                : "Gerar HLS de todos episódios com upload"}
            </button>
            <label className="mt-1 flex items-center gap-1 text-[11px] text-zinc-300">
              <input
                type="checkbox"
                checked={showOnlyNoUpload}
                onChange={(e) => setShowOnlyNoUpload(e.target.checked)}
                className="rounded"
              />
              Mostrar apenas episódios sem upload
            </label>
          </div>
        )}
      </div>

      {!isSeries && !loading && data && (
        <div className="rounded-md border border-amber-700 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
          Este título não é do tipo série/anime. As temporadas e episódios só se aplicam a séries/animes.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {info}
        </div>
      )}
      {episodeUploadBusy && episodeUploadTarget && (
        <div className="rounded-md border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-200">
          Enviando arquivo para S
          {episodeUploadTarget.seasonNumber.toString().padStart(2, "0")}E
          {episodeUploadTarget.episodeNumber.toString().padStart(2, "0")}...
        </div>
      )}

      {loading && (
        <p className="text-xs text-zinc-500">Carregando temporadas e episódios...</p>
      )}

      {data && seasons.length === 0 && !loading && isSeries && (
        <p className="text-xs text-zinc-500">
          Nenhuma temporada importada ainda. Use os botões acima para importar a partir do TMDb.
        </p>
      )}

      {data && filteredSeasons.length > 0 && (
        <div className="space-y-4 text-xs">
          {filteredSeasons.map((season) => (
            <div
              key={season.id}
              className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">
                    T{season.seasonNumber.toString().padStart(2, "0")} – {season.name || "Sem título"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {season.episodeCount ?? season.episodes.length} episódio(s)
                    {season.airDate && (
                      <span className="ml-2">
                        · {new Date(season.airDate).getFullYear()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleImportSeason(season.seasonNumber)}
                    disabled={importingSeason === season.seasonNumber}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-100 hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {importingSeason === season.seasonNumber
                      ? "Reimportando temporada..."
                      : "Reimportar temporada"}
                  </button>
                  {season.posterUrl && (
                    <img
                      src={season.posterUrl}
                      alt={season.name || "Poster da temporada"}
                      className="h-20 w-14 rounded border border-zinc-800 object-cover"
                    />
                  )}
                </div>
              </div>

              {season.episodes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {season.episodes.map((ep) => (
                    <div
                      key={ep.id}
                      className="flex items-start gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-2"
                    >
                      {ep.stillUrl ? (
                        <img
                          src={ep.stillUrl}
                          alt={ep.name}
                          className="h-16 w-28 flex-shrink-0 rounded border border-zinc-800 object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-28 flex-shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-800 text-[10px] text-zinc-400">
                          S{ep.seasonNumber.toString().padStart(2, "0")}E
                          {ep.episodeNumber.toString().padStart(2, "0")}
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-semibold text-zinc-50">
                              S{ep.seasonNumber.toString().padStart(2, "0")}E
                              {ep.episodeNumber.toString().padStart(2, "0")} – {ep.name}
                            </div>
                            {ep.airDate && (
                              <div className="text-[10px] text-zinc-500" suppressHydrationWarning>
                                {new Date(ep.airDate).toLocaleDateString("pt-BR")}
                                {ep.runtime && ` · ${ep.runtime} min`}
                              </div>
                            )}
                          </div>
                          {(() => {
                            const status = episodeHlsStatus[ep.id] ?? "none";

                            if (status === "hls_ready") {
                              return (
                                <span className="rounded-md border border-emerald-700 px-2 py-0.5 text-[10px] text-emerald-300 bg-emerald-900/40">
                                  HLS pronto
                                </span>
                              );
                            }

                            if (status === "uploaded") {
                              return (
                                <span className="rounded-md border border-blue-700 px-2 py-0.5 text-[10px] text-blue-300 bg-blue-900/40">
                                  Upload feito (HLS pendente)
                                </span>
                              );
                            }

                            if (status === "error") {
                              return (
                                <span className="rounded-md border border-red-700 px-2 py-0.5 text-[10px] text-red-300 bg-red-900/40">
                                  Erro ao verificar HLS
                                </span>
                              );
                            }

                            return (
                              <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
                                Sem upload
                              </span>
                            );
                          })()}
                        </div>
                        {(() => {
                          const status = episodeHlsStatus[ep.id] ?? "none";
                          if (status !== "none") return null;
                          return (
                            <button
                              type="button"
                              onClick={() => handleEpisodeUploadClick(ep)}
                              disabled={episodeUploadBusy}
                              className="mt-1 inline-flex items-center gap-1 rounded-md border border-emerald-700 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
                            >
                              📤 Upload vídeo
                            </button>
                          );
                        })()}
                        {ep.overview && (
                          <p className="line-clamp-2 text-[11px] text-zinc-300">
                            {ep.overview}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
