"use client";

import { useRef, useState, useEffect } from "react";
import PremiumTitleCard from "./PremiumTitleCard";

interface Title {
  id: string;
  name: string;
  posterUrl: string | null;
  backdropUrl?: string | null;
  type: string;
  releaseDate?: string | null;
  voteAverage?: number | null;
  progress?: number;
  genres?: Array<{ name: string }>;
}

interface PremiumTitleRowProps {
  title: string;
  titles: Title[];
  showNewBadge?: boolean;
}

export default function PremiumTitleRow({ title, titles, showNewBadge }: PremiumTitleRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScroll);
      return () => scrollEl.removeEventListener('scroll', checkScroll);
    }
  }, [titles]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current && !isScrolling) {
      setIsScrolling(true);
      const scrollAmount = direction === 'left' ? -1000 : 1000;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(() => setIsScrolling(false), 600);
    }
  };

  if (!titles || titles.length === 0) return null;

  return (
    <div style={{ marginBottom: '3rem', position: 'relative' }}>
      {/* Title with Accent */}
      <div style={{ paddingLeft: '3%', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '4px',
            height: '28px',
            background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)',
            borderRadius: '2px',
          }}
        />
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'white',
            letterSpacing: '-0.5px',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {title}
        </h2>
      </div>

      {/* Scroll Container Wrapper */}
      <div style={{ position: 'relative', paddingLeft: '3%', paddingRight: '3%' }}>
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            style={{
              position: 'absolute',
              left: '0',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: '50px',
              height: '100%',
              background: 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, transparent 100%)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingLeft: '10px',
              transition: 'all 0.3s ease',
              opacity: isScrolling ? 0 : 1,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, rgba(0,0,0,0.95) 0%, transparent 100%)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, transparent 100%)';
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </div>
          </button>
        )}

        {/* Titles Container */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            paddingTop: '10px',
            paddingBottom: '20px',
          }}
        >
          {titles.map((item) => (
            <PremiumTitleCard
              key={item.id}
              id={item.id}
              name={item.name}
              posterUrl={item.posterUrl}
              backdropUrl={item.backdropUrl}
              type={item.type}
              year={item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined}
              rating={item.voteAverage || undefined}
              progress={item.progress}
              genres={item.genres?.map(g => g.name)}
              showNewBadge={showNewBadge}
            />
          ))}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            style={{
              position: 'absolute',
              right: '0',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: '50px',
              height: '100%',
              background: 'linear-gradient(to left, rgba(0,0,0,0.8) 0%, transparent 100%)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: '10px',
              transition: 'all 0.3s ease',
              opacity: isScrolling ? 0 : 1,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to left, rgba(0,0,0,0.95) 0%, transparent 100%)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to left, rgba(0,0,0,0.8) 0%, transparent 100%)';
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
