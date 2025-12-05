"use client";

import { useState } from "react";
import Link from "next/link";

interface TitleDetailHeroProps {
  title: {
    id: string;
    name: string;
    overview: string | null;
    backdropUrl: string | null;
    posterUrl: string | null;
    releaseDate: Date | null;
    voteAverage: number | null;
    runtime: number | null;
    type: string;
  };
  genres: Array<{ id: string; name: string }>;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function TitleDetailHero({
  title,
  genres,
  isFavorite,
  onToggleFavorite,
}: TitleDetailHeroProps) {
  const [showTrailer, setShowTrailer] = useState(false);

  const year = title.releaseDate ? title.releaseDate.getFullYear() : null;
  const runtime = title.runtime
    ? `${Math.floor(title.runtime / 60)}h ${title.runtime % 60}min`
    : null;

  return (
    <div className="relative min-h-[70vh] w-full overflow-hidden bg-black">
      {/* Background */}
      <div className="absolute inset-0">
        {title.backdropUrl && (
          <>
            <img
              src={title.backdropUrl}
              alt={title.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="flex flex-col gap-8 md:flex-row md:items-end">
          {/* Poster */}
          {title.posterUrl && (
            <div className="flex-shrink-0">
              <img
                src={title.posterUrl}
                alt={title.name}
                className="w-48 rounded-lg shadow-2xl md:w-64"
              />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 space-y-4">
            <h1 className="text-4xl font-extrabold text-white md:text-5xl lg:text-6xl">
              {title.name}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-200">
              {year && <span className="font-semibold">{year}</span>}
              {runtime && (
                <>
                  <span>•</span>
                  <span>{runtime}</span>
                </>
              )}
              {title.voteAverage && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    <span className="font-semibold">{title.voteAverage.toFixed(1)}</span>
                  </div>
                </>
              )}
              <span>•</span>
              <span className="rounded bg-zinc-800/80 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold uppercase">
                {title.type}
              </span>
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {genres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/genres/${genre.id}`}
                    className="rounded-full border border-zinc-700 bg-zinc-900/60 backdrop-blur-sm px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/80 transition-all"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Overview */}
            {title.overview && (
              <p className="max-w-3xl text-base text-zinc-200 md:text-lg">
                {title.overview}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={`/watch/${title.id}`}
                className="flex items-center gap-2 rounded-lg bg-white px-8 py-3 font-semibold text-black shadow-lg transition-all hover:bg-zinc-200 hover:scale-105"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Assistir Agora</span>
              </Link>

              <button
                onClick={setShowTrailer.bind(null, true)}
                className="flex items-center gap-2 rounded-lg border-2 border-zinc-600 bg-zinc-900/60 backdrop-blur-sm px-6 py-3 font-semibold text-white shadow-lg transition-all hover:border-zinc-400 hover:bg-zinc-800/80"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Trailer</span>
              </button>

              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 font-semibold shadow-lg transition-all ${
                    isFavorite
                      ? "border-red-600 bg-red-900/60 text-red-300 hover:bg-red-900/80"
                      : "border-zinc-600 bg-zinc-900/60 text-white hover:border-zinc-400 hover:bg-zinc-800/80"
                  }`}
                  title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <svg className="h-5 w-5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="hidden sm:inline">{isFavorite ? "Favorito" : "Favoritar"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fade to content */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}
