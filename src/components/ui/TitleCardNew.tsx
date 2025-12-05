"use client";

import { useState } from "react";
import Link from "next/link";

interface TitleCardNewProps {
  id: string;
  name: string;
  posterUrl: string | null;
  type: string;
  year?: number;
  rating?: number;
}

export default function TitleCardNew({
  id,
  name,
  posterUrl,
  type,
  year,
  rating,
}: TitleCardNewProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ minWidth: '200px', width: '200px' }}
    >
      <Link href={`/title/${id}`} className="block">
        {/* Card Container */}
        <div className="relative overflow-hidden rounded-lg bg-zinc-900 transition-all duration-300 hover:scale-105 hover:z-50 hover:shadow-2xl">
          {/* Aspect Ratio Container */}
          <div style={{ paddingBottom: '150%', position: 'relative' }}>
            {/* Poster Image */}
            {posterUrl && !imageError ? (
              <img
                src={posterUrl}
                alt={name}
                className="absolute top-0 left-0 w-full h-full object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-zinc-800">
                <span style={{ fontSize: '3rem' }}>🎬</span>
              </div>
            )}

            {/* Hover Overlay */}
            {isHovered && (
              <div
                className="absolute bottom-0 left-0 right-0 p-3 bg-black bg-opacity-90"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 100%)',
                }}
              >
                {/* Title */}
                <h3 className="text-sm font-semibold text-white mb-2" style={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {name}
                </h3>

                {/* Info */}
                <div className="flex items-center gap-2 text-xs text-zinc-300 mb-3">
                  {year && <span>{year}</span>}
                  {rating && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <span style={{ color: '#facc15' }}>★</span>
                        <span>{rating.toFixed(1)}</span>
                      </div>
                    </>
                  )}
                  {type && (
                    <>
                      <span>•</span>
                      <span style={{ textTransform: 'uppercase', fontSize: '10px' }}>{type}</span>
                    </>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/title/${id}`;
                    }}
                    className="flex-1 bg-white text-black px-3 py-2 rounded text-xs font-semibold hover:bg-gray-200 transition-colors"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    ▶ Assistir
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      // Add to favorites
                    }}
                    className="bg-zinc-800 text-white p-2 rounded hover:bg-zinc-700 transition-colors"
                    title="Adicionar aos favoritos"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
