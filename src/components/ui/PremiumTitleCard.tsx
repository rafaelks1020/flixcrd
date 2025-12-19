"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Info, Plus } from "lucide-react";

interface PremiumTitleCardProps {
  id: string;
  href?: string;
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
  href,
  name,
  posterUrl,
  type,
  year,
  rating,
  progress,
  genres,
  showNewBadge,
}: PremiumTitleCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const isNew = showNewBadge || (year && year >= new Date().getFullYear() - 1);
  const quality = rating && rating > 8 ? "4K" : rating && rating > 6 ? "HD" : "SD";
  const linkHref = href ?? `/title/${id}`;

  return (
    <div
      className="group/card relative w-36 md:w-56 flex-shrink-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Card Container - NO SCALING, just simple hover */}
      <div className="relative rounded-md overflow-hidden bg-zinc-900 transition-all duration-300">
        {/* Poster Image */}
        <Link href={linkHref} className="block">
          <div className="aspect-[2/3] relative">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
                🎬
              </div>
            )}

            {/* Badges */}
            {isNew && (
              <div className="absolute top-2 left-2">
                <span className="bg-red-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-sm shadow-md">
                  NOVO
                </span>
              </div>
            )}

            {/* Progress Bar */}
            {progress !== undefined && progress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                <div
                  className="h-full bg-red-600"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/40 transition-all duration-300" />
          </div>
        </Link>

        {/* Info Panel - Slides up from bottom on hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-3 pt-8"
            >
              {/* Buttons */}
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href={`/watch/${id}`}
                  className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Play size={12} fill="currentColor" />
                </Link>

                <button
                  className="w-7 h-7 rounded-full border border-white/40 text-white flex items-center justify-center hover:border-white hover:bg-white/10 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus size={14} />
                </button>

                <Link
                  href={linkHref}
                  className="w-7 h-7 rounded-full border border-white/40 text-white flex items-center justify-center hover:border-white hover:bg-white/10 transition-colors ml-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Info size={14} />
                </Link>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2 text-[9px] font-semibold text-zinc-400">
                {rating && <span className="text-green-400">{Math.round(rating * 10)}%</span>}
                {quality && <span className="border border-white/40 px-1 rounded text-white">{quality}</span>}
                {year && <span>{year}</span>}
              </div>

              {/* Genres */}
              {genres && genres.length > 0 && (
                <div className="flex gap-1 mt-1 text-[9px] text-white/70">
                  {genres.slice(0, 2).map((genre, i) => (
                    <span key={i}>
                      {genre}{i < Math.min(genres.length, 2) - 1 ? " •" : ""}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
