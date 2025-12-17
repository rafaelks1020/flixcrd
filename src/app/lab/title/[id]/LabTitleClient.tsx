"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import PremiumNavbar from "@/components/ui/PremiumNavbar";

interface Season {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterUrl: string | null;
  overview: string;
}

interface Episode {
  episodeNumber: number;
  name: string;
  overview: string;
  stillUrl: string | null;
  airDate: string | null;
  runtime: number | null;
  voteAverage: number;
}

interface TitleDetails {
  id: string;
  tmdbId: number;
  imdbId: string | null;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  voteAverage: number;
  releaseDate: string | null;
  runtime: number | null;
  genres: string[];
  type: "MOVIE" | "SERIES";
  status: string | null;
  tagline: string | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  seasons: Season[];
}

interface SeasonDetails {
  seasonNumber: number;
  name: string;
  overview: string;
  posterUrl: string | null;
  airDate: string | null;
  episodes: Episode[];
}

interface LabTitleClientProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  tmdbId: string;
  mediaType: "movie" | "tv";
}

export default function LabTitleClient({
  isLoggedIn,
  isAdmin,
  tmdbId,
  mediaType,
}: LabTitleClientProps) {
  const router = useRouter();

  const [title, setTitle] = useState<TitleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(null);
  const [loadingSeason, setLoadingSeason] = useState(false);

  // Carregar detalhes do título
  useEffect(() => {
    async function loadTitle() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/lab/titulo/${tmdbId}?type=${mediaType}`);

        if (!res.ok) {
          setError("Título não encontrado");
          return;
        }

        const data: TitleDetails = await res.json();
        setTitle(data);

        // Se for série, carregar primeira temporada automaticamente
        if (data.type === "SERIES" && data.seasons.length > 0) {
          setSelectedSeason(data.seasons[0].seasonNumber);
        }
      } catch (err) {
        console.error("Erro ao carregar título:", err);
        setError("Erro ao carregar detalhes");
      } finally {
        setLoading(false);
      }
    }

    loadTitle();
  }, [tmdbId, mediaType]);

  // Carregar episódios da temporada selecionada
  useEffect(() => {
    if (!title || title.type !== "SERIES" || !selectedSeason) return;

    async function loadSeason() {
      try {
        setLoadingSeason(true);

        const res = await fetch(`/api/lab/titulo/${tmdbId}/temporada/${selectedSeason}`);

        if (res.ok) {
          const data: SeasonDetails = await res.json();
          setSeasonDetails(data);
        }
      } catch (err) {
        console.error("Erro ao carregar temporada:", err);
      } finally {
        setLoadingSeason(false);
      }
    }

    loadSeason();
  }, [title, tmdbId, selectedSeason]);

  function handlePlay() {
    if (!title) return;

    if (title.type === "MOVIE") {
      // Filme: usar IMDb ID
      const id = title.imdbId || title.tmdbId;
      router.push(`/lab/watch?type=filme&id=${id}`);
    } else {
      // Série: ir para o primeiro episódio
      router.push(`/lab/watch?type=serie&id=${title.tmdbId}&season=${selectedSeason}&episode=1`);
    }
  }

  function handlePlayEpisode(episodeNumber: number) {
    if (!title) return;
    router.push(`/lab/watch?type=serie&id=${title.tmdbId}&season=${selectedSeason}&episode=${episodeNumber}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
        <div className="flex items-center justify-center h-screen">
          <div className="text-white text-lg">Carregando...</div>
        </div>
      </div>
    );
  }

  if (error || !title) {
    return (
      <div className="min-h-screen bg-black">
        <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <div className="text-white text-lg">{error || "Título não encontrado"}</div>
          <Link
            href="/lab"
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-500 transition"
          >
            Voltar ao Catálogo
          </Link>
        </div>
      </div>
    );
  }

  const year = title.releaseDate ? new Date(title.releaseDate).getFullYear() : null;

  return (
    <div className="min-h-screen bg-black">
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {/* Hero com Backdrop */}
      <div className="relative h-[70vh] min-h-[500px]">
        {title.backdropUrl && (
          <>
            <img
              src={title.backdropUrl}
              alt={title.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
          </>
        )}

        <div className="relative z-10 flex h-full items-end pb-16 px-4 md:px-12">
          <div className="flex gap-8 items-end max-w-6xl">
            {/* Poster */}
            {title.posterUrl && (
              <img
                src={title.posterUrl}
                alt={title.name}
                className="hidden md:block w-64 rounded-xl shadow-2xl border border-white/10"
              />
            )}

            {/* Info */}
            <div className="flex-1 space-y-4">
              <h1 className="text-4xl md:text-6xl font-extrabold text-white drop-shadow-2xl">
                {title.name}
              </h1>

              {title.tagline && (
                <p className="text-lg text-zinc-300 italic">{title.tagline}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-200">
                {year && <span className="font-semibold">{year}</span>}
                {title.voteAverage > 0 && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      <span className="font-semibold">{title.voteAverage.toFixed(1)}</span>
                    </div>
                  </>
                )}
                {title.runtime && (
                  <>
                    <span>•</span>
                    <span>{title.runtime} min</span>
                  </>
                )}
                {title.type === "SERIES" && title.numberOfSeasons && (
                  <>
                    <span>•</span>
                    <span>{title.numberOfSeasons} temporada{title.numberOfSeasons > 1 ? "s" : ""}</span>
                  </>
                )}
                <span>•</span>
                <span className="px-2 py-0.5 bg-zinc-800/80 rounded text-xs font-semibold uppercase">
                  {title.type === "MOVIE" ? "Filme" : "Série"}
                </span>
              </div>

              {title.genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {title.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-3 py-1 bg-white/10 rounded-full text-xs text-zinc-200"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {title.overview && (
                <p className="text-zinc-300 text-sm md:text-base max-w-2xl line-clamp-4">
                  {title.overview}
                </p>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handlePlay}
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-full font-semibold shadow-xl hover:from-red-500 hover:to-red-400 transition-all hover:scale-105"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Assistir</span>
                </button>

                <Link
                  href="/lab"
                  className="flex items-center gap-2 px-6 py-4 bg-zinc-800/80 text-white rounded-full font-semibold hover:bg-zinc-700/80 transition"
                >
                  ← Voltar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo - Temporadas e Episódios para Séries */}
      {title.type === "SERIES" && title.seasons.length > 0 && (
        <div className="px-4 md:px-12 py-8 space-y-6">
          {/* Seletor de Temporada */}
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">Episódios</h2>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            >
              {title.seasons.map((season) => (
                <option key={season.seasonNumber} value={season.seasonNumber}>
                  {season.name} ({season.episodeCount} eps)
                </option>
              ))}
            </select>
          </div>

          {/* Lista de Episódios */}
          {loadingSeason ? (
            <div className="text-zinc-400">Carregando episódios...</div>
          ) : seasonDetails ? (
            <div className="grid gap-4">
              {seasonDetails.episodes.map((ep) => (
                <button
                  key={ep.episodeNumber}
                  onClick={() => handlePlayEpisode(ep.episodeNumber)}
                  className="flex gap-4 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 hover:border-red-500/50 hover:bg-zinc-800/80 transition-all text-left group"
                >
                  {/* Thumbnail */}
                  <div className="relative w-40 h-24 flex-shrink-0 bg-zinc-800 rounded-lg overflow-hidden">
                    {ep.stillUrl ? (
                      <img
                        src={ep.stillUrl}
                        alt={ep.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        🎬
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-sm">E{ep.episodeNumber}</span>
                      <span className="text-white font-semibold truncate">{ep.name}</span>
                      {ep.runtime && (
                        <span className="text-zinc-500 text-sm ml-auto">{ep.runtime} min</span>
                      )}
                    </div>
                    {ep.overview && (
                      <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{ep.overview}</p>
                    )}
                    {ep.airDate && (
                      <p className="text-zinc-600 text-xs mt-2">
                        {new Date(ep.airDate).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-zinc-400">Nenhum episódio disponível</div>
          )}
        </div>
      )}

      {/* Para filmes, mostrar info adicional */}
      {title.type === "MOVIE" && (
        <div className="px-4 md:px-12 py-8">
          <div className="max-w-4xl">
            <h2 className="text-2xl font-bold text-white mb-4">Sinopse</h2>
            <p className="text-zinc-300 leading-relaxed">{title.overview}</p>
          </div>
        </div>
      )}
    </div>
  );
}
