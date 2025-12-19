"use client";

import { useRef, useState } from "react";
import TitleCard from "./TitleCard";

interface Title {
  id: string;
  name: string;
  href?: string;
  posterUrl: string | null;
  backdropUrl?: string | null;
  type: string;
  voteAverage?: number | null;
  releaseDate?: string | null;
  progress?: number;
}

interface TitleRowProps {
  title: string;
  titles: Title[];
  onAddFavorite?: (titleId: string) => void;
}

export default function TitleRow({ title, titles, onAddFavorite }: TitleRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (!rowRef.current) return;
    
    const scrollAmount = rowRef.current.clientWidth * 0.8;
    const newScrollLeft = rowRef.current.scrollLeft + (direction === "right" ? scrollAmount : -scrollAmount);
    
    rowRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });

    // Update arrow visibility
    setTimeout(() => {
      if (!rowRef.current) return;
      setShowLeftArrow(rowRef.current.scrollLeft > 10);
      setShowRightArrow(
        rowRef.current.scrollLeft < rowRef.current.scrollWidth - rowRef.current.clientWidth - 10
      );
    }, 300);
  };

  if (!titles || titles.length === 0) return null;

  return (
    <div className="group relative mb-8">
      {/* Title */}
      <h2 className="mb-4 px-4 text-xl font-bold text-white md:px-8 md:text-2xl">
        {title}
      </h2>

      {/* Left Arrow */}
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-10 flex h-full w-12 -translate-y-1/2 items-center justify-center bg-gradient-to-r from-black/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100 hover:from-black/90"
          aria-label="Scroll left"
        >
          <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={rowRef}
        className="flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-hide md:gap-3 md:px-8"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {titles.map((title) => (
          <div key={title.id} className="w-36 flex-shrink-0 md:w-48">
            <TitleCard
              {...title}
              onAddFavorite={onAddFavorite ? () => onAddFavorite(title.id) : undefined}
            />
          </div>
        ))}
      </div>

      {/* Right Arrow */}
      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-10 flex h-full w-12 -translate-y-1/2 items-center justify-center bg-gradient-to-l from-black/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100 hover:from-black/90"
          aria-label="Scroll right"
        >
          <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
