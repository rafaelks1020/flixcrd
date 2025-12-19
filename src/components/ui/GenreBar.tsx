"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Genre {
    id: string;
    name: string;
}

interface GenreBarProps {
    genres: Genre[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}

export default function GenreBar({ genres, selectedId, onSelect }: GenreBarProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: "left" | "right") => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const scrollTo = direction === "left"
                ? scrollLeft - clientWidth * 0.7
                : scrollLeft + clientWidth * 0.7;

            scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
        }
    };

    return (
        <div className="relative group/bar py-6">
            {/* Scroll Buttons - Only visible on hover or if scrollable */}
            <button
                onClick={() => scroll("left")}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-white opacity-0 group-hover/bar:opacity-100 transition-opacity hover:bg-zinc-900 shadow-2xl mr-4"
            >
                <ChevronLeft size={20} />
            </button>

            <div
                ref={scrollRef}
                className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 md:px-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* "Todos" Option */}
                <button
                    onClick={() => onSelect(null)}
                    className={cn(
                        "flex-shrink-0 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
                        selectedId === null
                            ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                            : "bg-zinc-900/50 text-zinc-500 border-white/5 hover:border-white/20 hover:text-white backdrop-blur-md"
                    )}
                >
                    Tudo
                </button>

                {genres.map((genre) => (
                    <button
                        key={genre.id}
                        onClick={() => onSelect(genre.id)}
                        className={cn(
                            "flex-shrink-0 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all border whitespace-nowrap",
                            selectedId === genre.id
                                ? "bg-primary text-white border-primary shadow-[0_0_20px_rgba(229,9,20,0.3)]"
                                : "bg-zinc-900/50 text-zinc-500 border-white/5 hover:border-white/20 hover:text-white backdrop-blur-md"
                        )}
                    >
                        {genre.name}
                    </button>
                ))}
            </div>

            <button
                onClick={() => scroll("right")}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-white opacity-0 group-hover/bar:opacity-100 transition-opacity hover:bg-zinc-900 shadow-2xl ml-4"
            >
                <ChevronRight size={20} />
            </button>

            {/* Fade Gradients for visual cues */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent pointer-events-none z-10 hidden md:block" />
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent pointer-events-none z-10 hidden md:block" />
        </div>
    );
}
