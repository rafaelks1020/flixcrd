"use client";

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

interface PremiumHeroProps {
  title: HeroTitle | null;
  isLoggedIn: boolean;
}

export default function PremiumHero({ title, isLoggedIn }: PremiumHeroProps) {
  if (!title) return null;

  const year = title.releaseDate ? new Date(title.releaseDate).getFullYear() : null;
  const rating = title.voteAverage ? title.voteAverage.toFixed(1) : null;

  return (
    <section
      style={{
        position: 'relative',
        height: '90vh',
        minHeight: '600px',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Background Image */}
      {title.backdropUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${title.backdropUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
      )}

      {/* Gradients Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.4) 40%, transparent 100%)',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 4%',
          paddingTop: '68px',
          maxWidth: '650px',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.1,
            marginBottom: '16px',
            textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          {title.name}
        </h1>

        {/* Meta */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          {rating && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.15)',
                padding: '6px 12px',
                borderRadius: '4px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <span style={{ color: '#ffd700', fontSize: '16px' }}>★</span>
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{rating}</span>
            </div>
          )}
          {year && (
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', fontWeight: 500 }}>
              {year}
            </span>
          )}
          {title.type && (
            <span
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                background: 'rgba(255,255,255,0.1)',
                padding: '4px 10px',
                borderRadius: '4px',
              }}
            >
              {title.type}
            </span>
          )}
        </div>

        {/* Overview */}
        {title.overview && (
          <p
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '16px',
              lineHeight: 1.6,
              marginBottom: '28px',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              maxWidth: '550px',
            }}
          >
            {title.overview}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Play Button */}
          <Link
            href={`/title/${title.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 32px',
              background: '#fff',
              borderRadius: '4px',
              color: '#000',
              fontSize: '16px',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg style={{ width: '24px', height: '24px' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Assistir
          </Link>

          {/* More Info Button */}
          <Link
            href={`/title/${title.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 28px',
              background: 'rgba(109, 109, 110, 0.7)',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(109, 109, 110, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(109, 109, 110, 0.7)';
            }}
          >
            <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Mais informações
          </Link>

          {/* Add to List */}
          {isLoggedIn && (
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                background: 'rgba(42, 42, 42, 0.6)',
                border: '2px solid rgba(255,255,255,0.5)',
                borderRadius: '50%',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#fff';
                e.currentTarget.style.background = 'rgba(42, 42, 42, 0.8)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
                e.currentTarget.style.background = 'rgba(42, 42, 42, 0.6)';
              }}
              title="Adicionar à Minha Lista"
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Bottom fade */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '150px',
          background: 'linear-gradient(to top, #000 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />
    </section>
  );
}
