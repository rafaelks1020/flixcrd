"use client";

import { motion } from "framer-motion";
import { Play, Info, Plus, Star } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrowseHeroProps {
    title: {
        id: string;
        name: string;
        backdropUrl: string | null;
        overview: string | null;
        type: string;
        voteAverage?: number | null;
        releaseDate?: string | null;
    };
}

export default function BrowseHero({ title }: BrowseHeroProps) {
    if (!title) return null;

    return (
        <div className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden group">
            {/* Background Image with Gradient Overlays */}
            <div className="absolute inset-0">
                <img
                    src={title.backdropUrl || "/placeholder-backdrop.jpg"}
                    alt={title.name}
                    className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[10s] ease-out"
                />
                {/* Cinematic Gradients */}
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
                <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* Hero Content */}
            <div className="absolute inset-0 flex flex-col justify-end px-4 md:px-12 pb-24 md:pb-32 max-w-[1700px] mx-auto w-full">
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="max-w-2xl space-y-6"
                >
                    {/* Metadata Badges */}
                    <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-red-600 text-[10px] font-black uppercase tracking-widest rounded-sm text-white shadow-lg">
                            Em Destaque
                        </span>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 backdrop-blur-md rounded-md border border-white/10">
                            <Star size={12} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-[10px] font-black text-white">
                                {title.voteAverage ? (title.voteAverage * 10).toFixed(0) : "N/A"}% match
                            </span>
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            {title.type === "MOVIE" ? "Filme" : "Série"} • {title.releaseDate ? new Date(title.releaseDate).getFullYear() : "N/A"}
                        </span>
                    </div>

                    {/* Title */}
                    <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white uppercase leading-[0.8] drop-shadow-2xl">
                        {title.name}
                    </h1>

                    {/* Overview */}
                    <p className="text-sm md:text-lg text-zinc-300 font-medium line-clamp-3 md:line-clamp-4 max-w-xl drop-shadow-lg leading-relaxed">
                        {title.overview || "Explore esta nova adição incrível ao nosso catálogo. Assista agora em 4K HDR."}
                    </p>

                    {/* Primary Actions */}
                    <div className="flex flex-wrap items-center gap-4 pt-4">
                        <Link
                            href={`/watch/${title.id}`}
                            className="h-12 md:h-14 px-8 md:px-12 bg-white text-black rounded-xl font-black uppercase text-xs md:text-sm tracking-[0.2em] flex items-center gap-3 hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/10"
                        >
                            <Play size={20} fill="currentColor" />
                            Assistir Agora
                        </Link>

                        <Link
                            href={`/title/${title.id}`}
                            className="h-12 md:h-14 px-8 md:px-12 bg-zinc-900/80 backdrop-blur-xl text-white border border-white/10 rounded-xl font-black uppercase text-xs md:text-sm tracking-[0.2em] flex items-center gap-3 hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95 shadow-2xl"
                        >
                            <Info size={20} />
                            Mais Infos
                        </Link>

                        <button className="w-12 h-12 md:w-14 md:h-14 bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center rounded-xl text-white hover:bg-white/10 hover:border-white/20 transition-all hover:scale-105 active:scale-95 group/plus">
                            <Plus size={24} className="group-hover/plus:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Bottom Gradient Fade to Content */}
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black to-transparent pointer-events-none" />
        </div>
    );
}
