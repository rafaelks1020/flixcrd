"use client";

import { useState } from "react";
import Link from "next/link";
// Image from next/image disponível se precisar migrar de <img>
// import Image from "next/image";

interface TitleCardProps {
  id: string;
  name: string;
  href?: string;
  posterUrl: string | null;
  backdropUrl?: string | null;
  type: string;
  voteAverage?: number | null;
  releaseDate?: string | null;
  progress?: number;
  isNew?: boolean;
  quality?: "4K" | "HD" | "SD";
  onAddFavorite?: () => void;
}

export default function TitleCard({
  id,
  name,
  href,
  posterUrl,
  backdropUrl,
  type,
  voteAverage,
  releaseDate,
  progress,
  isNew,
  quality,
  onAddFavorite,
}: TitleCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

  return (
    <Link href={href ?? `/title/${id}`}>
      <div
        className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-black/50 hover:z-10"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Poster Image */}
        {posterUrl && !imageError ? (
          <img
            src={posterUrl}
            alt={name}
            className="h-full w-full object-cover transition-opacity duration-300"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-800">
            <span className="text-4xl">🎬</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isNew && (
            <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
              NOVO
            </span>
          )}
          {quality && (
            <span className="rounded bg-zinc-900/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
              {quality}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {progress !== undefined && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
            <div
              className="h-full bg-red-600 transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}

        {/* Hover Info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black via-black/90 to-transparent">
          <h3 className="text-sm font-semibold text-white line-clamp-2 mb-1">
            {name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            {year && <span>{year}</span>}
            {voteAverage && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  <span>{voteAverage.toFixed(1)}</span>
                </div>
              </>
            )}
            {type && (
              <>
                <span>•</span>
                <span className="uppercase text-[10px]">{type}</span>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                // Play action
              }}
              className="flex-1 rounded bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
            >
              ▶ Assistir
            </button>
            {onAddFavorite && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onAddFavorite();
                }}
                className="rounded bg-zinc-800/90 backdrop-blur-sm p-1.5 text-white hover:bg-zinc-700 transition-colors"
                title="Adicionar aos favoritos"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Backdrop Preview on Hover (optional) */}
        {isHovered && backdropUrl && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
            <img
              src={backdropUrl}
              alt=""
              className="h-full w-full object-cover blur-sm scale-110"
            />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}
      </div>
    </Link>
  );
}
