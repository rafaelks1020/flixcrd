"use client";

import { useState } from "react";
import Link from "next/link";

interface Episode {
  id: string;
  episodeNumber: number;
  name: string;
  overview: string | null;
  stillPath: string | null;
  runtime: number | null;
}

interface Season {
  id: string;
  seasonNumber: number;
  name: string;
  episodes: Episode[];
}

interface EpisodeListProps {
  titleId: string;
  seasons: Season[];
}

export default function EpisodeList({ titleId, seasons }: EpisodeListProps) {
  const [selectedSeason, setSelectedSeason] = useState(0);

  if (!seasons || seasons.length === 0) return null;

  const currentSeason = seasons[selectedSeason];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Episódios</h2>
        
        {/* Season Selector */}
        {seasons.length > 1 && (
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(Number(e.target.value))}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/50"
          >
            {seasons.map((season, index) => (
              <option key={season.id} value={index}>
                {season.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Episodes */}
      <div className="space-y-3">
        {currentSeason.episodes.map((episode) => (
          <Link
            key={episode.id}
            href={`/watch/${titleId}?episodeId=${episode.id}`}
            className="group flex gap-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900/80"
          >
            {/* Thumbnail */}
            <div className="relative flex-shrink-0 w-40 aspect-video overflow-hidden rounded bg-zinc-800">
              {episode.stillPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w300${episode.stillPath}`}
                  alt={episode.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-600">
                  🎬
                </div>
              )}
              {/* Play Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="rounded-full bg-white/90 p-3">
                  <svg className="h-6 w-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-white group-hover:text-red-400 transition-colors">
                  {episode.episodeNumber}. {episode.name}
                </h3>
                {episode.runtime && (
                  <span className="flex-shrink-0 text-xs text-zinc-500">
                    {episode.runtime} min
                  </span>
                )}
              </div>
              {episode.overview && (
                <p className="text-sm text-zinc-400 line-clamp-2">
                  {episode.overview}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
