"use client";

import { useState } from "react";
import Link from "next/link";

interface PremiumTitleCardProps {
  id: string;
  name: string;
  posterUrl: string | null;
  backdropUrl?: string | null;
  type: string;
  year?: number;
  rating?: number;
  progress?: number;
  genres?: string[];
  showNewBadge?: boolean;
}

export default function PremiumTitleCard({
  id,
  name,
  posterUrl,
  backdropUrl,
  type,
  year,
  rating,
  progress,
  genres,
  showNewBadge,
}: PremiumTitleCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const quality = rating && rating > 8 ? "4K" : rating && rating > 6 ? "HD" : "SD";
  const isNew = showNewBadge || (year && year >= new Date().getFullYear() - 1);

  return (
    <div
      className="premium-card-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        minWidth: '220px',
        width: '220px',
        transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: isHovered ? 'scale(1.15)' : 'scale(1)',
        zIndex: isHovered ? 50 : 1,
        position: 'relative',
      }}
    >
      <Link href={`/title/${id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: isHovered 
              ? '0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(220, 38, 38, 0.3)' 
              : '0 4px 8px rgba(0,0,0,0.4)',
            transition: 'box-shadow 0.4s ease',
          }}
        >
          {/* Main Poster Container */}
          <div style={{ position: 'relative', paddingBottom: '150%' }}>
            {/* Poster Image */}
            {posterUrl && !imageError ? (
              <img
                src={posterUrl}
                alt={name}
                onError={() => setImageError(true)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.4s ease',
                  transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, #1f1f1f 0%, #0a0a0a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '4rem', opacity: 0.3 }}>🎬</span>
              </div>
            )}

            {/* Top Badges */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px', flexDirection: 'column', zIndex: 10 }}>
              {isNew && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.5)',
                  }}
                >
                  NOVO
                </div>
              )}
              {quality && (
                <div
                  style={{
                    background: quality === '4K' 
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                      : quality === 'HD'
                      ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                      : 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {quality}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {progress !== undefined && progress > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'rgba(255,255,255,0.2)',
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(progress, 100)}%`,
                    background: 'linear-gradient(90deg, #dc2626 0%, #f87171 100%)',
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 10px rgba(220, 38, 38, 0.5)',
                  }}
                />
              </div>
            )}

            {/* Hover Overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)',
                padding: '20px 12px 12px 12px',
                transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
                opacity: isHovered ? 1 : 0,
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                pointerEvents: isHovered ? 'auto' : 'none',
              }}
            >
              {/* Title */}
              <h3
                style={{
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: '1.3',
                }}
              >
                {name}
              </h3>

              {/* Info Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {year && (
                  <span style={{ color: '#d4d4d8', fontSize: '12px', fontWeight: '500' }}>
                    {year}
                  </span>
                )}
                {rating && (
                  <>
                    <span style={{ color: '#52525b' }}>•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#facc15', fontSize: '14px' }}>★</span>
                      <span style={{ color: '#d4d4d8', fontSize: '12px', fontWeight: '500' }}>
                        {rating.toFixed(1)}
                      </span>
                    </div>
                  </>
                )}
                {type && (
                  <>
                    <span style={{ color: '#52525b' }}>•</span>
                    <span
                      style={{
                        color: '#a1a1aa',
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontWeight: '600',
                      }}
                    >
                      {type}
                    </span>
                  </>
                )}
              </div>

              {/* Genres */}
              {genres && genres.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {genres.slice(0, 2).map((genre, index) => (
                    <span
                      key={index}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: '#d4d4d8',
                        fontSize: '10px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Play Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = `/title/${id}`;
                  }}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.6)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Assistir</span>
                </button>

                {/* Info Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = `/title/${id}`;
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  title="Mais informações"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>

                {/* Add Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    // Add to favorites logic
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  title="Adicionar à lista"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
