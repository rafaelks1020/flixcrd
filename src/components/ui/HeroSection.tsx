"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface HeroTitle {
  id: string;
  name: string;
  overview: string | null;
  backdropUrl: string | null;
  releaseDate: Date | string | null;
  voteAverage: number | null;
  type?: string;
}

interface HeroSectionProps {
  title: HeroTitle | null;
  isLoggedIn: boolean;
}

export default function HeroSection({ title, isLoggedIn }: HeroSectionProps) {
  // isMuted e showVideo preparados para exibir vídeo de fundo no futuro
  const [_isMuted, _setIsMuted] = useState(true);
  const [_showVideo, setShowVideo] = useState(false);
  void _isMuted;
  void _setIsMuted;
  void _showVideo;

  useEffect(() => {
    // Auto-show video after 2s
    const timer = setTimeout(() => setShowVideo(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!title) return null;

  const year = title.releaseDate
    ? new Date(title.releaseDate).getFullYear()
    : null;

  return (
    <section className="relative h-[85vh] min-h-[600px] w-full overflow-hidden bg-black pt-16">
      {/* Background Image/Video */}
      <div className="absolute inset-0">
        {title.backdropUrl && (
          <>
            <img
              src={title.backdropUrl}
              alt={title.name}
              className="h-full w-full object-cover"
              loading="eager"
            />
            {/* Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-24 md:px-12 md:pb-32">
        <div className="max-w-2xl space-y-4 animate-fade-in">
          {/* Title */}
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-2xl md:text-6xl lg:text-7xl">
            {title.name}
          </h1>

          {/* Meta Info */}
          <div className="flex items-center gap-3 text-sm text-zinc-200 md:text-base">
            {year && <span className="font-semibold">{year}</span>}
            {title.voteAverage && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  <span className="font-semibold">
                    {title.voteAverage.toFixed(1)}
                  </span>
                </div>
              </>
            )}
            {title.type && (
              <>
                <span>•</span>
                <span className="rounded bg-zinc-800/80 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold uppercase">
                  {title.type}
                </span>
              </>
            )}
          </div>

          {/* Overview */}
          {title.overview && (
            <p className="line-clamp-3 text-sm text-zinc-200 drop-shadow-lg md:text-base lg:line-clamp-4">
              {title.overview}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-4">
            {/* Primary: Assistir */}
            <Link
              href={`/title/${title.id}`}
              className="flex items-center gap-3 rounded-full bg-gradient-to-r from-red-600 to-red-500 px-8 py-3 text-sm font-semibold text-white shadow-xl hover:from-red-500 hover:to-red-400 transition-all hover:scale-105"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span>Assistir</span>
            </Link>

            {/* Secondary: Mais informações */}
            <Link
              href={`/title/${title.id}`}
              className="flex items-center gap-2 rounded-full border border-zinc-500 bg-zinc-900/70 px-7 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-all hover:border-white hover:bg-zinc-800/80"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Mais informações</span>
            </Link>

            {/* Tertiary: Favoritos */}
            {isLoggedIn && (
              <button
                className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/60 text-white shadow-lg backdrop-blur-sm transition-all hover:border-white hover:bg-zinc-800/80"
                title="Adicionar aos favoritos"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fade to content */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}
