"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PremiumTitleCard from "./PremiumTitleCard";

interface Title {
  id: string;
  href?: string;
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
  onDelete?: (id: string) => void;
}

export default function PremiumTitleRow({ title, titles, showNewBadge, onDelete }: PremiumTitleRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  // Check scroll buttons visibility
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      // Small buffer for float precision
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        scrollEl.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [titles]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      setIsScrolling(true);
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(() => setIsScrolling(false), 500);
    }
  };

  if (!titles || titles.length === 0) return null;

  return (
    <div className="mb-12 relative group/row hover:z-[100] transition-all duration-300">
      {/* Row Title */}
      <div className="px-4 md:px-12 mb-4 flex items-center gap-3">
        <div className="w-1 h-6 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]" />
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight drop-shadow-md group-hover/row:text-primary transition-colors duration-300">
          {title}
        </h2>
      </div>

      {/* Carousel Container */}
      <div className="relative group/carousel">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-20 w-12 md:w-16 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 backdrop-blur-sm"
          >
            <ChevronLeft size={32} className="transform hover:scale-125 transition-transform" />
          </button>
        )}

        {/* Scrollable Area */}
        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide px-4 md:px-12 py-24 -my-20"
          style={{ scrollBehavior: 'smooth' }}
        >
          {titles.map((item) => (
            <PremiumTitleCard
              key={item.id}
              id={item.id}
              href={item.href}
              name={item.name}
              posterUrl={item.posterUrl}
              backdropUrl={item.backdropUrl}
              type={item.type}
              year={item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined}
              rating={item.voteAverage || undefined}
              progress={item.progress}
              genres={item.genres?.map(g => g.name)}
              showNewBadge={showNewBadge}
              onDelete={onDelete}
            />
          ))}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-20 w-12 md:w-16 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 backdrop-blur-sm"
          >
            <ChevronRight size={32} className="transform hover:scale-125 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}
