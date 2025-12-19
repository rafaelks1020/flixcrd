"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Info, Plus, Star, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

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
  playHref?: string;
  infoHref?: string;
}

export default function PremiumHero({ title, isLoggedIn, playHref, infoHref }: PremiumHeroProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!title) return null;

  const year = title.releaseDate ? new Date(title.releaseDate).getFullYear() : null;
  const rating = title.voteAverage ? title.voteAverage.toFixed(1) : null;
  const playLink = playHref ?? `/title/${title.id}`;
  const infoLink = infoHref ?? `/title/${title.id}`;

  return (
    <section className="relative w-full h-[85vh] md:h-[95vh] min-h-[500px] overflow-hidden group">
      {/* Dynamic Background with Ken Burns Effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={title?.backdropUrl}
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0"
        >
          {title?.backdropUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[20s] ease-linear group-hover:scale-110"
              style={{ backgroundImage: `url(${title.backdropUrl})` }}
            />
          )}
          {/* Cinematic Gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col justify-center h-full px-4 md:px-16 pt-20 max-w-4xl">
        <motion.div
          key={title?.id}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          {/* Meta Badges */}
          <div className="flex items-center gap-3 mb-4">
            {title?.type && (
              <span className="px-2 py-0.5 rounded text-[10px] md:text-xs font-bold tracking-widest uppercase bg-white/20 text-white backdrop-blur-md border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                {title.type}
              </span>
            )}
            {year && (
              <span className="flex items-center gap-1 text-xs md:text-sm font-medium text-zinc-300">
                <Calendar size={12} /> {year}
              </span>
            )}
            {rating && (
              <span className="flex items-center gap-1 text-xs md:text-sm font-medium text-yellow-400">
                <Star size={12} fill="currentColor" /> {rating}
              </span>
            )}
          </div>

          {/* Title - Staggered entrance */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-4xl md:text-7xl lg:text-8xl font-black text-white leading-[0.9] tracking-tight mb-6 drop-shadow-2xl"
          >
            {title?.name}
          </motion.h1>

          {/* Overview */}
          {title?.overview && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-zinc-300 text-sm md:text-lg leading-relaxed line-clamp-3 md:line-clamp-4 max-w-xl mb-8 drop-shadow-md"
            >
              {title.overview}
            </motion.p>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex flex-wrap items-center gap-3"
          >
            <Link
              href={playLink}
              className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded font-bold text-base md:text-lg transition-colors hover:bg-white/90 active:scale-95"
            >
              <Play fill="currentColor" size={20} />
              Assistir
            </Link>

            <Link
              href={infoLink}
              className="flex items-center gap-2 px-6 py-3 bg-white/20 text-white rounded font-bold text-base md:text-lg backdrop-blur-md transition-colors hover:bg-white/30 active:scale-95"
            >
              <Info size={20} />
              Mais Info
            </Link>

            {isLoggedIn && (
              <button
                className="flex items-center gap-2 px-6 py-3 bg-white/20 text-white rounded font-bold text-base md:text-lg backdrop-blur-md transition-colors hover:bg-white/30 active:scale-95"
              >
                <Plus size={20} />
                Minha Lista
              </button>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
