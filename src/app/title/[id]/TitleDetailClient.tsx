"use client";

import { useState, useRef, type RefObject } from "react";
import Link from "next/link";
import PremiumNavbar from "@/components/ui/PremiumNavbar";

interface TitleData {
  id: string;
  name: string;
  originalName?: string | null;
  overview?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  releaseDate?: string | Date | null;
  voteAverage?: number | null;
  type?: string | null;
  runtime?: number | null;
  status?: string | null;
}

interface CastMember {
  id: string | number;
  name: string;
  character?: string | null;
  profilePath?: string | null;
}

interface CrewMember {
  id: string | number;
  name: string;
  job?: string | null;
  department?: string | null;
  profilePath?: string | null;
}

interface Episode {
  id: string;
  name: string;
  episodeNumber: number;
  overview?: string;
  stillPath?: string;
  runtime?: number;
}

interface Season {
  id: string;
  seasonNumber: number;
  name?: string;
  episodes?: Episode[];
}

interface SimilarTitle {
  id: string;
  name: string;
  posterUrl?: string | null;
  voteAverage?: number | null;
}

interface Video {
  id: string;
  key: string;
  name: string;
  type: string;
  site: string;
}

interface TitleDetailClientProps {
  title: TitleData;
  genres: string[];
  cast: CastMember[];
  crew: CrewMember[];
  seasons: Season[];
  similarTitles: SimilarTitle[];
  videos: Video[];
  isFavorite: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export default function TitleDetailClient({
  title,
  genres,
  cast,
  crew,
  seasons,
  similarTitles,
  videos,
  isFavorite: initialIsFavorite,
  isLoggedIn,
  isAdmin,
}: TitleDetailClientProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.seasonNumber || 1);

  const castRowRef = useRef<HTMLDivElement | null>(null);
  const similarRowRef = useRef<HTMLDivElement | null>(null);
  const videosRowRef = useRef<HTMLDivElement | null>(null);

  const scrollRow = (ref: RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    const container = ref.current;
    if (!container) return;
    const delta = direction === "left" ? -360 : 360;
    container.scrollBy({ left: delta, behavior: "smooth" });
  };

  const year = title.releaseDate ? new Date(title.releaseDate).getFullYear() : null;
  const rating = title.voteAverage?.toFixed(1);
  const isSeries = title.type === 'SERIES' || title.type === 'ANIME';

  const currentSeason = seasons.find((s) => s.seasonNumber === selectedSeason);
  const episodes = currentSeason?.episodes || [];

  const handleAddFavorite = async () => {
    // Toggle favorite logic here
    setIsFavorite(!isFavorite);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {/* Hero Section */}
      <div style={{ position: 'relative', minHeight: '70vh' }}>
        {/* Background */}
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
        
        {/* Gradients */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.3) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000 0%, transparent 50%)' }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'flex-end', minHeight: '70vh', padding: '0 4%', paddingBottom: '60px', paddingTop: '100px', gap: '40px' }}>
          {/* Poster */}
          <div style={{ flexShrink: 0, width: '280px', display: 'none' }} className="md-show">
            {title.posterUrl ? (
              <img
                src={title.posterUrl}
                alt={title.name}
                style={{ width: '100%', borderRadius: '8px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
              />
            ) : (
              <div style={{ aspectRatio: '2/3', background: '#1a1a1a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>🎬</div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, maxWidth: '700px' }}>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, marginBottom: '12px', lineHeight: 1.1 }}>
              {title.name}
              {year && <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}> ({year})</span>}
            </h1>

            {title.originalName && title.originalName !== title.name && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '16px' }}>{title.originalName}</p>
            )}

            {/* Meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {rating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '4px' }}>
                  <span style={{ color: '#ffd700', fontSize: '16px' }}>★</span>
                  <span style={{ fontWeight: 600 }}>{rating}</span>
                </div>
              )}
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {title.type === 'MOVIE' ? 'Filme' : title.type === 'SERIES' ? 'Série' : title.type === 'ANIME' ? 'Anime' : title.type}
              </span>
              {title.runtime && (
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                  {Math.floor(title.runtime / 60)}h {title.runtime % 60}min
                </span>
              )}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {genres.map((genre, i) => (
                  <span key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '20px', fontSize: '13px' }}>
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Overview */}
            {title.overview && (
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '16px', lineHeight: 1.7, marginBottom: '28px', maxWidth: '600px' }}>
                {title.overview}
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link
                href={isSeries && seasons[0]?.episodes?.[0] ? `/watch/${title.id}?episodeId=${seasons[0].episodes[0].id}` : `/watch/${title.id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '16px 36px', background: '#fff', borderRadius: '4px', color: '#000', fontSize: '16px', fontWeight: 700, textDecoration: 'none', transition: 'transform 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg style={{ width: '24px', height: '24px' }} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Assistir
              </Link>

              <button
                onClick={handleAddFavorite}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', background: 'rgba(42, 42, 42, 0.6)', border: `2px solid ${isFavorite ? '#fff' : 'rgba(255,255,255,0.5)'}`, borderRadius: '50%', color: '#fff', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = '#fff'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = isFavorite ? '#fff' : 'rgba(255,255,255,0.5)'}
              >
                {isFavorite ? (
                  <svg style={{ width: '24px', height: '24px' }} fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                ) : (
                  <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div style={{ padding: '40px 4%' }}>
        {/* Episodes */}
        {isSeries && seasons.length > 0 && (
          <section style={{ marginBottom: '60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Episódios</h2>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '8px 16px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}
              >
                {seasons.map((s) => (
                  <option key={s.seasonNumber} value={s.seasonNumber}>Temporada {s.seasonNumber}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {episodes.map((ep) => (
                <Link
                  key={ep.id}
                  href={`/watch/${title.id}?episodeId=${ep.id}`}
                  style={{ display: 'flex', gap: '16px', background: '#141414', borderRadius: '4px', overflow: 'hidden', textDecoration: 'none', color: '#fff', transition: 'background 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#1a1a1a'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#141414'}
                >
                  <div style={{ width: '180px', flexShrink: 0, position: 'relative' }}>
                    <div style={{ paddingBottom: '56.25%', background: '#0a0a0a' }}>
                      {ep.stillPath && (
                        <img src={ep.stillPath} alt={ep.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg style={{ width: '16px', height: '16px', marginLeft: '2px' }} fill="#fff" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '16px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{ep.episodeNumber}. {ep.name}</span>
                      {ep.runtime && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{ep.runtime}min</span>}
                    </div>
                    {ep.overview && (
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ep.overview}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Cast */}
        {cast.length > 0 && (
          <section style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Elenco</h2>
            <div style={{ position: 'relative' }}>
              {cast.length > 6 && (
                <button
                  type="button"
                  onClick={() => scrollRow(castRowRef, "left")}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 20,
                    width: '40px',
                    height: '40px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.35), rgba(0,0,0,0.95))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              )}
              {cast.length > 6 && (
                <button
                  type="button"
                  onClick={() => scrollRow(castRowRef, "right")}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 20,
                    width: '40px',
                    height: '40px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.35), rgba(0,0,0,0.95))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              )}
              <div
                ref={castRowRef}
                className="scrollbar-hide"
                style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', scrollBehavior: 'smooth' }}
              >
              {cast.slice(0, 12).map((person) => (
                <div key={person.id} style={{ flexShrink: 0, width: '140px', textAlign: 'center' }}>
                  <div style={{ width: '140px', height: '140px', borderRadius: '50%', overflow: 'hidden', marginBottom: '12px', background: '#1a1a1a' }}>
                    {person.profilePath ? (
                      <img src={person.profilePath} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', color: '#333' }}>👤</div>
                    )}
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{person.name}</p>
                  {person.character && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{person.character}</p>}
                </div>
              ))}
              </div>
            </div>
          </section>
        )}

        {/* Similar Titles */}
        {similarTitles.length > 0 && (
          <section style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Títulos Semelhantes</h2>
            <div style={{ position: 'relative' }}>
              {similarTitles.length > 6 && (
                <button
                  type="button"
                  onClick={() => scrollRow(similarRowRef, "left")}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 20,
                    width: '40px',
                    height: '40px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.35), rgba(0,0,0,0.95))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              )}
              {similarTitles.length > 6 && (
                <button
                  type="button"
                  onClick={() => scrollRow(similarRowRef, "right")}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 20,
                    width: '40px',
                    height: '40px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.35), rgba(0,0,0,0.95))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              )}
              <div
                ref={similarRowRef}
                className="scrollbar-hide"
                style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', scrollBehavior: 'smooth' }}
              >
              {similarTitles.map((item) => (
                <Link
                  key={item.id}
                  href={`/title/${item.id}`}
                  style={{ flexShrink: 0, width: '200px', borderRadius: '4px', overflow: 'hidden', background: '#141414', textDecoration: 'none', color: '#fff', transition: 'transform 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt={item.name} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '2/3', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>🎬</div>
                  )}
                </Link>
              ))}
              </div>
            </div>
          </section>
        )}

        {/* Trailers */}
        {videos.length > 0 && (
          <section style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Trailers e Vídeos</h2>
            <div style={{ position: 'relative' }}>
              {videos.filter((v) => v.site === 'YouTube').length > 2 && (
                <button
                  type="button"
                  onClick={() => scrollRow(videosRowRef, "left")}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 20,
                    width: '40px',
                    height: '40px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.35), rgba(0,0,0,0.95))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              )}
              {videos.filter((v) => v.site === 'YouTube').length > 2 && (
                <button
                  type="button"
                  onClick={() => scrollRow(videosRowRef, "right")}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 20,
                    width: '40px',
                    height: '40px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.35), rgba(0,0,0,0.95))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              )}
              <div
                ref={videosRowRef}
                className="scrollbar-hide"
                style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', scrollBehavior: 'smooth' }}
              >
                {videos
                  .filter((v) => v.site === 'YouTube')
                  .slice(0, 6)
                  .map((video) => (
                    <div
                      key={video.id}
                      style={{
                        flexShrink: 0,
                        width: '360px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#141414',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          paddingBottom: '56.25%',
                          background: '#000',
                        }}
                      >
                        <iframe
                          src={`https://www.youtube.com/embed/${video.key}`}
                          title={video.name}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            border: '0',
                          }}
                        />
                      </div>
                      <div style={{ padding: '12px' }}>
                        <p style={{ fontWeight: 600, fontSize: '14px' }}>{video.name}</p>
                        <p
                          style={{
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: '12px',
                            marginTop: '4px',
                          }}
                        >
                          {video.type}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
