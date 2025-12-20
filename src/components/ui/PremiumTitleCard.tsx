"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Info, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const isNew = showNewBadge || (year && year >= new Date().getFullYear() - 1);
  const quality = rating && rating > 8 ? "4K" : rating && rating > 6 ? "HD" : "SD";
  const linkHref = href ?? `/title/${id}`;

  return (
    <motion.div
      layout
      className="group/card relative w-[160px] sm:w-[200px] md:w-[240px] lg:w-[260px] xl:w-[300px] flex-shrink-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Container */}
      <div className={cn(
        "relative rounded-2xl overflow-hidden bg-zinc-950 transition-all duration-500 border border-white/5",
        "group-hover/card:border-primary/50 group-hover/card:shadow-[0_0_40px_rgba(229,9,20,0.15)]",
        "group-hover/card:z-50"
      )}>
        {/* Poster with Zoom Effect */}
        <div className="aspect-[2/3] relative overflow-hidden">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={name}
              className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border-white/5 text-zinc-700">
              <Play size={40} className="opacity-20 mb-2" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-20">Sem Poster</span>
            </div>
          )}

          {/* Badges Overlay */}
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
            {isNew && (
              <span className="bg-primary text-[8px] font-black text-white px-2 py-0.5 rounded-md shadow-lg uppercase tracking-widest border border-white/10">
                Novo
              </span>
            )}
            <span className="bg-black/60 backdrop-blur-md text-white md:text-[8px] text-[7px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest border border-white/5 group-hover/card:bg-primary transition-colors">
              {type === "MOVIE" ? "Filme" : type === "SERIES" ? "Série" : "Anime"}
            </span>
          </div>

          {rating && (
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10">
                <Star size={8} className="text-yellow-400 fill-yellow-400" />
                <span className="text-[9px] font-black text-white">{(rating * 10).toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* Progress Bar (Legacy style bit refined) */}
          {progress !== undefined && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
              <div
                className="h-full bg-primary shadow-[0_0_10px_rgba(229,9,20,0.8)]"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}

          {/* Dark Overlay that reveals on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-500" />
        </div>

        {/* Cinematic Content Revel - Slides up on hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ y: "20%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "20%", opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none"
            >
              <div className="pointer-events-auto space-y-3">
                <h4 className="text-xs md:text-sm font-black text-white uppercase tracking-tighter line-clamp-2 leading-none">
                  {name}
                </h4>

                <div className="flex items-center gap-2 overflow-hidden">
                  <Link
                    href={linkHref}
                    className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-transform active:scale-90 shadow-xl"
                  >
                    <Play size={14} fill="currentColor" />
                  </Link>
                  <Link
                    href={linkHref}
                    className="flex-1 h-8 rounded-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all group/info"
                  >
                    <span className="text-[8px] font-black uppercase tracking-widest group-hover/info:text-primary transition-colors">Detalhes</span>
                  </Link>
                  <button className="w-8 h-8 rounded-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center hover:bg-primary transition-all active:scale-90">
                    <Plus size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-zinc-500">
                  <div className="flex gap-2">
                    {year && <span>{year}</span>}
                    <span className="text-zinc-700">|</span>
                    <span className="text-zinc-300">{quality}</span>
                  </div>
                  {genres && genres.length > 0 && (
                    <span className="line-clamp-1 max-w-[50px] text-right">{genres[0]}</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Name Label (Always Visible) */}
      <div className="mt-3 px-1 transition-opacity duration-300 group-hover/card:opacity-0">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 line-clamp-1 group-hover/card:text-white transition-colors">
          {name}
        </h3>
      </div>
    </motion.div>
  );
}
