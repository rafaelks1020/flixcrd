"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface Title {
  id: string;
  name: string;
  type: string;
  tmdbId: number;
}

interface Episode {
  id: string;
  name: string;
  seasonNumber: number;
  episodeNumber: number;
  hasSubtitle: boolean;
}

interface Subtitle {
  id: string;
  language: string;
  fileName: string;
  downloadCount: number;
  rating: number;
  release: string;
  uploader: string;
  url: string;
  fileId: number | string;
  source: string;
}

export default function SubtitlesPage() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<Title | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Carregar títulos (séries/animes)
  useEffect(() => {
    async function loadTitles() {
      try {
        // Buscar todos os títulos e filtrar séries/animes no cliente
        const res = await fetch("/api/titles?limit=1000");
        if (!res.ok) {
          throw new Error("Erro ao buscar títulos");
        }
        const data = (await res.json()) as
          | Title[]
          | {
              data?: Title[];
              page?: number;
              limit?: number;
              total?: number;
              totalPages?: number;
            };

        // API retorna objeto paginado ({ data, page, ... }) ou array direto, filtrar por tipo
        const allTitles: Title[] = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
          ? data.data
          : [];
        const filtered = allTitles.filter(
          (t) => t.type === "SERIES" || t.type === "ANIME"
        );
        setTitles(filtered);
      } catch (error) {
        console.error("Erro ao carregar títulos:", error);
      }
    }
    loadTitles();
  }, []);

  // Carregar episódios do título selecionado
  async function loadEpisodes(title: Title) {
    setLoading(true);
    setSelectedTitle(title);
    setEpisodes([]);
    setSubtitles([]);
    setSelectedEpisode(null);

    try {
      const res = await fetch(`/api/titles/${title.id}/seasons`);
      const seasons = await res.json();

      const allEpisodes: Episode[] = [];
      for (const season of seasons) {
        if (season.episodes) {
          for (const ep of season.episodes) {
            allEpisodes.push({
              id: ep.id,
              name: ep.name,
              seasonNumber: season.seasonNumber,
              episodeNumber: ep.episodeNumber,
              hasSubtitle: Boolean((ep as { hasSubtitle?: boolean }).hasSubtitle),
            });
          }
        }
      }

      setEpisodes(allEpisodes);
    } catch (error) {
      console.error("Erro ao carregar episódios:", error);
      toast.error("Erro ao carregar episódios");
    } finally {
      setLoading(false);
    }
  }

  // Buscar legendas para um episódio
  async function searchSubtitles(episode: Episode) {
    if (!selectedTitle) return;

    setSearching(true);
    setSelectedEpisode(episode);
    setSubtitles([]);

    try {
      const params = new URLSearchParams({
        tmdbId: selectedTitle.tmdbId.toString(),
        type: selectedTitle.type,
        season: episode.seasonNumber.toString(),
        episode: episode.episodeNumber.toString(),
        name: selectedTitle.name,
        language: "pt-BR",
      });

      const res = await fetch(`/api/subtitles/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao buscar legendas");
      }

      setSubtitles(data.subtitles || []);

      if (data.subtitles.length === 0) {
        toast.error("Nenhuma legenda encontrada para este episódio");
      } else {
        toast.success(`${data.subtitles.length} legendas encontradas!`);
      }
    } catch (error: unknown) {
      console.error("Erro ao buscar legendas:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Erro ao buscar legendas";
      toast.error(message);
    } finally {
      setSearching(false);
    }
  }

  // Baixar legenda automaticamente e salvar no Wasabi
  async function downloadSubtitle(subtitle: Subtitle) {
    if (!selectedEpisode) {
      toast.error("Nenhum episódio selecionado");
      return;
    }

    setDownloading(subtitle.id);

    try {
      // Se for busca externa, abrir URL diretamente (não tem como automatizar)
      if (subtitle.source === "Busca Externa") {
        window.open(subtitle.url, "_blank");
        toast.success(`Abrindo ${subtitle.source}...`);
        setDownloading(null);
        return;
      }

      // OpenSubtitles - baixar automaticamente e salvar no Wasabi
      if (subtitle.source === "OpenSubtitles" && typeof subtitle.fileId === "number") {
        const res = await fetch("/api/subtitles/auto-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeId: selectedEpisode.id,
            fileId: subtitle.fileId,
            language: subtitle.language || "pt-BR",
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Erro ao baixar legenda");
        }

        toast.success(`✅ Legenda salva automaticamente!`);

        // Atualizar o badge do episódio para mostrar que agora tem legenda
        setEpisodes((prev) =>
          prev.map((ep) =>
            ep.id === selectedEpisode.id ? { ...ep, hasSubtitle: true } : ep
          )
        );

        // Atualizar o episódio selecionado também
        setSelectedEpisode((prev) =>
          prev ? { ...prev, hasSubtitle: true } : prev
        );

        return;
      }

      // Subdl ou outros - abrir URL
      window.open(subtitle.url, "_blank");
      toast.success(`Abrindo ${subtitle.source}...`);
    } catch (error: unknown) {
      console.error("Erro ao baixar legenda:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Erro ao baixar legenda";
      toast.error(message);
    } finally {
      setDownloading(null);
    }
  }

  // Buscar legendas para TODOS os episódios
  async function searchAllSubtitles() {
    if (!selectedTitle || episodes.length === 0) return;

    const confirmed = confirm(
      `Buscar legendas para TODOS os ${episodes.length} episódios de "${selectedTitle.name}"?\n\nIsso pode demorar alguns minutos.`
    );

    if (!confirmed) return;

    toast.loading(`Buscando legendas para ${episodes.length} episódios...`);

    let found = 0;
    let notFound = 0;

    for (const episode of episodes) {
      try {
        const params = new URLSearchParams({
          tmdbId: selectedTitle.tmdbId.toString(),
          type: selectedTitle.type,
          season: episode.seasonNumber.toString(),
          episode: episode.episodeNumber.toString(),
          name: selectedTitle.name,
          language: "pt-BR",
        });

        const res = await fetch(`/api/subtitles/search?${params.toString()}`);
        const data = await res.json();

        if (data.subtitles && data.subtitles.length > 0) {
          found++;
          console.log(
            `✓ S${episode.seasonNumber.toString().padStart(2, "0")}E${episode.episodeNumber.toString().padStart(2, "0")} - ${data.subtitles.length} legendas`
          );
        } else {
          notFound++;
          console.log(
            `✗ S${episode.seasonNumber.toString().padStart(2, "0")}E${episode.episodeNumber.toString().padStart(2, "0")} - Sem legendas`
          );
        }

        // Delay para não sobrecarregar a API
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        notFound++;
        console.error(`Erro no episódio ${episode.id}:`, error);
      }
    }

    toast.dismiss();
    toast.success(
      `Busca concluída!\n✓ ${found} episódios com legendas\n✗ ${notFound} sem legendas`
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">🎬 Gerenciar Legendas</h2>
        <p className="text-zinc-400 text-sm">
          Buscar e baixar legendas para séries e animes
        </p>
      </div>

      {/* Seletor de Título */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h3 className="text-sm font-semibold mb-3">1. Selecione um Título</h3>
        <select
          value={selectedTitle?.id || ""}
          onChange={(e) => {
            const title = titles.find((t) => t.id === e.target.value);
            if (title) loadEpisodes(title);
          }}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100"
        >
          <option value="">Selecione uma série ou anime...</option>
          {titles.map((title) => (
            <option key={title.id} value={title.id}>
              {title.name} ({title.type})
            </option>
          ))}
        </select>
      </div>

      {/* Lista de Episódios */}
      {selectedTitle && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              2. Episódios ({episodes.length})
            </h3>
            {episodes.length > 0 && (
              <button
                onClick={searchAllSubtitles}
                className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                🔍 Buscar Legendas para TODOS
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-zinc-400">
              Carregando episódios...
            </div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              Nenhum episódio encontrado
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  className={`flex items-center justify-between p-3 rounded-md border ${
                    selectedEpisode?.id === episode.id
                      ? "border-emerald-600 bg-emerald-900/20"
                      : "border-zinc-800 bg-zinc-900/40"
                  }`}
                >
                  <div>
                    <span className="font-mono text-xs text-zinc-400">
                      S{episode.seasonNumber.toString().padStart(2, "0")}E
                      {episode.episodeNumber.toString().padStart(2, "0")}
                    </span>
                    <span className="ml-2 text-sm">{episode.name}</span>
                    <div className="mt-1 text-[10px]">
                      {episode.hasSubtitle ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-700 bg-emerald-900/40 px-2 py-0.5 text-emerald-300">
                          🟢 Com legenda
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-zinc-400">
                          ⚪ Sem legenda
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => searchSubtitles(episode)}
                    disabled={searching}
                    className="rounded-md bg-zinc-700 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-600 disabled:opacity-50"
                  >
                    {searching && selectedEpisode?.id === episode.id
                      ? "Buscando..."
                      : "Buscar Legendas"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resultados de Legendas */}
      {selectedEpisode && subtitles.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold mb-3">
            3. Legendas Encontradas ({subtitles.length})
          </h3>
          <div className="space-y-2">
            {subtitles.map((subtitle) => (
              <div
                key={subtitle.id}
                className="flex items-center justify-between p-3 rounded-md border border-zinc-800 bg-zinc-900/40"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{subtitle.fileName}</span>
                    <span className="text-xs text-zinc-500">
                      ({subtitle.language})
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      subtitle.source === "OpenSubtitles" 
                        ? "bg-blue-900/50 text-blue-300" 
                        : subtitle.source === "Subdl"
                        ? "bg-purple-900/50 text-purple-300"
                        : "bg-orange-900/50 text-orange-300"
                    }`}>
                      {subtitle.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    {subtitle.downloadCount > 0 && <span>⬇️ {subtitle.downloadCount}</span>}
                    {subtitle.rating > 0 && <span>⭐ {subtitle.rating.toFixed(1)}</span>}
                    <span>👤 {subtitle.uploader}</span>
                    {subtitle.release && (
                      <span className="text-[10px] text-zinc-500 max-w-xs truncate">
                        {subtitle.release}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => downloadSubtitle(subtitle)}
                  disabled={downloading === subtitle.id}
                  className={`rounded-md px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                    subtitle.source === "OpenSubtitles"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-zinc-600 hover:bg-zinc-500"
                  }`}
                >
                  {downloading === subtitle.id
                    ? "⏳ Salvando..."
                    : subtitle.source === "OpenSubtitles"
                    ? "⬇️ Baixar e Salvar"
                    : "🔗 Abrir Site"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
