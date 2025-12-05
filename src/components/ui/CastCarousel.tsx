"use client";

import { useRef } from "react";

interface CastMember {
  id: string;
  name: string;
  character: string;
  profilePath: string | null;
}

interface CastCarouselProps {
  cast: CastMember[];
}

export default function CastCarousel({ cast }: CastCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === "right" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  };

  if (!cast || cast.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Elenco</h2>
      
      <div className="group relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/80 p-2 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
        >
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {cast.map((member) => (
            <div
              key={member.id}
              className="flex-shrink-0 w-32 space-y-2 group/item"
            >
              <div className="aspect-square overflow-hidden rounded-full bg-zinc-800">
                {member.profilePath ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${member.profilePath}`}
                    alt={member.name}
                    className="h-full w-full object-cover transition-transform group-hover/item:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl text-zinc-600">
                    👤
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white line-clamp-1">
                  {member.name}
                </p>
                <p className="text-xs text-zinc-400 line-clamp-1">
                  {member.character}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/80 p-2 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
        >
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
