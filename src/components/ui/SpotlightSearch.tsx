"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Clapperboard, Monitor, TrendingUp, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SpotlightSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Handle Cmd+K / Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Close search when route changes
    useEffect(() => {
        setIsOpen(false);
    }, [router]);

    const handleSearch = useCallback(async (q: string) => {
        if (q.length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/titles?q=${encodeURIComponent(q)}&limit=6`);
            const json = await res.json();
            // Handle both array and object { data: [] } response formats
            const searchData = Array.isArray(json) ? json : (json?.data || []);
            setResults(searchData);
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query) handleSearch(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, handleSearch]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4 md:px-0">
                    {/* Backdrop Blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-xl"
                    />

                    {/* Search Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative w-full max-w-2xl bg-zinc-900/90 border border-white/10 rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden"
                    >
                        {/* Input Area */}
                        <div className="relative border-b border-white/5 p-6">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-zinc-500" size={24} />
                            <input
                                autoFocus
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Busque por filmes, séries ou atores..."
                                className="w-full bg-transparent pl-12 pr-12 text-xl font-medium text-white placeholder:text-zinc-600 focus:outline-none"
                            />
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                            >
                                <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-zinc-400">
                                    ESC
                                </kbd>
                                <X className="md:hidden" size={20} />
                            </button>
                        </div>

                        {/* Results / Help Area */}
                        <div className="max-h-[60vh] overflow-y-auto scrollbar-hide py-4 px-2">
                            {query.length < 2 ? (
                                <div className="space-y-6 p-4">
                                    <div className="space-y-4">
                                        <h3 className="px-2 text-xs font-black uppercase tracking-widest text-zinc-500">
                                            Buscas Sugeridas
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <button className="flex items-center gap-3 w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left font-bold text-sm">
                                                <TrendingUp size={16} className="text-primary" />
                                                Lançamentos da Semana
                                            </button>
                                            <button className="flex items-center gap-3 w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left font-bold text-sm">
                                                <Clapperboard size={16} className="text-primary" />
                                                Melhores Filmes 2024
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 px-2 text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                                        <History size={12} />
                                        Dica: use Cmd + K para buscar de qualquer lugar
                                    </div>
                                </div>
                            ) : loading ? (
                                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    <p className="mt-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Vasculhando a biblioteca...</p>
                                </div>
                            ) : results.length > 0 ? (
                                <div className="grid grid-cols-1 gap-1">
                                    {results.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setIsOpen(false); // Close search when clicking
                                                if (item.id.startsWith("lab-")) {
                                                    const tmdbId = item.id.split("-").pop();
                                                    const type = item.type === "MOVIE" ? "movie" : "tv";
                                                    router.push(`/lab/title/${tmdbId}?type=${type}`);
                                                } else {
                                                    router.push(`/title/${item.id}`);
                                                }
                                            }}
                                            className="group flex items-center gap-4 w-full p-3 rounded-xl hover:bg-white/5 transition-all text-left border border-transparent hover:border-white/5"
                                        >
                                            <div className="w-16 h-20 flex-shrink-0 relative rounded-lg overflow-hidden bg-zinc-800">
                                                {item.posterUrl ? (
                                                    <img src={item.posterUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xl">🎬</div>
                                                )}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <p className="text-lg font-black tracking-tight group-hover:text-primary transition-colors line-clamp-1">{item.name}</p>
                                                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                                                    <span className="text-primary/80">{item.type}</span>
                                                    {item.releaseDate && <span>{new Date(item.releaseDate).getFullYear()}</span>}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center uppercase tracking-widest">
                                    <div className="text-4xl mb-4 opacity-20">👻</div>
                                    <p className="text-xs font-black text-zinc-600">Nenhum rastro encontrado para "{query}"</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
