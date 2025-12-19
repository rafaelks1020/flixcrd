"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Calendar, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumCalendarCardProps {
    tmdbId: number;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    episodeTitle: string;
    posterUrl: string | null;
    airDate: string;
    status: string;
    onWatch: () => void;
}

export default function PremiumCalendarCard({
    tmdbId,
    seasonNumber,
    episodeNumber,
    title,
    episodeTitle,
    posterUrl,
    airDate,
    status,
    onWatch,
}: PremiumCalendarCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    const isReleased = status === "Atualizado" || status === "Hoje" || status === "Atrasado";
    const dateObj = new Date(airDate);
    const formattedDate = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    const weekday = dateObj.toLocaleDateString("pt-BR", { weekday: "long" });

    const statusColors = {
        "Atualizado": "bg-green-500/20 text-green-400 border-green-500/20",
        "Hoje": "bg-red-600 text-white border-red-500",
        "Futuro": "bg-zinc-800 text-zinc-400 border-zinc-700",
        "Atrasado": "bg-yellow-500/20 text-yellow-400 border-yellow-500/20",
    };

    const statusColor = statusColors[status as keyof typeof statusColors] || statusColors["Futuro"];

    return (
        <motion.div
            layout
            className="group/card relative w-full flex-shrink-0"
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
                            alt={title}
                            className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border-white/5 text-zinc-700">
                            <Calendar size={40} className="opacity-20 mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-20">Sem Poster</span>
                        </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                        <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md backdrop-blur-md border shadow-lg",
                            statusColor
                        )}>
                            {status}
                        </span>
                    </div>

                    {/* Episode Info Badge (Bottom Left) */}
                    <div className="absolute bottom-2 left-2 z-10">
                        <div className="bg-black/80 backdrop-blur-md border border-white/10 px-2 py-1 rounded-lg">
                            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                S{String(seasonNumber).padStart(2, '0')}E{String(episodeNumber).padStart(2, '0')}
                            </div>
                        </div>
                    </div>

                    {/* Dark Overlay that reveals on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-500" />
                </div>

                {/* Cinematic Content Revel */}
                <AnimatePresence>
                    {isHovered && (
                        <motion.div
                            initial={{ y: "20%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "20%", opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none"
                        >
                            <div className="pointer-events-auto space-y-3">
                                <div className="space-y-1">
                                    <h4 className="text-xs md:text-sm font-black text-white uppercase tracking-tighter line-clamp-2 leading-none">
                                        {title}
                                    </h4>
                                    <p className="text-[10px] text-zinc-400 font-medium line-clamp-1">{episodeTitle}</p>
                                </div>

                                <div className="flex items-center gap-2 overflow-hidden">
                                    <button
                                        onClick={onWatch}
                                        disabled={!isReleased}
                                        className={cn(
                                            "flex-1 h-9 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl",
                                            isReleased
                                                ? "bg-white text-black hover:bg-zinc-200 active:scale-95"
                                                : "bg-zinc-800/50 text-zinc-500 cursor-not-allowed border border-white/5"
                                        )}
                                    >
                                        {isReleased ? (
                                            <>
                                                <Play size={10} fill="currentColor" /> Assistir
                                            </>
                                        ) : (
                                            <>
                                                <Clock size={10} /> Em Breve
                                            </>
                                        )}
                                    </button>

                                    <Link
                                        href={`/lab/title/${tmdbId}?type=tv`}
                                        className="w-9 h-9 rounded-xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95"
                                    >
                                        <div className="w-1 h-1 bg-white rounded-full mx-[1px]" />
                                        <div className="w-1 h-1 bg-white rounded-full mx-[1px]" />
                                        <div className="w-1 h-1 bg-white rounded-full mx-[1px]" />
                                    </Link>
                                </div>

                                <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-zinc-500 border-t border-white/5 pt-3">
                                    <span className="text-zinc-300">{formattedDate}</span>
                                    <span>{weekday}</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Floating Name Label (Always Visible) */}
            <div className="mt-3 px-1 transition-opacity duration-300 group-hover/card:opacity-0">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 line-clamp-1 group-hover/card:text-white transition-colors">
                    {title}
                </h3>
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-0.5">
                    {formattedDate}
                </p>
            </div>
        </motion.div>
    );
}
