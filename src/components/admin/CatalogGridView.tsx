"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  Edit2,
  Play,
  Tv,
  Trash2,
  RefreshCw,
  Film,
  Info,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Badge from "@/components/admin/Badge";

interface Title {
  id: string;
  tmdbId: number | null;
  name: string;
  type: string;
  slug: string;
  originalName: string | null;
  overview: string | null;
  tagline: string | null;
  hlsPath: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
}

interface CatalogGridViewProps {
  titles: Title[];
  hlsStatus: Record<string, string>;
  pendingSummary: Record<string, { total: number; pending: number }>;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEdit: (title: Title) => void;
  onDelete: (id: string) => void;
  onTranscode: (id: string, type: string) => void;
}

export default function CatalogGridView({
  titles,
  hlsStatus,
  pendingSummary,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  onTranscode,
}: CatalogGridViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const safeTitles = Array.isArray(titles) ? titles : [];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
      {safeTitles.map((title) => {
        if (!title) return null;

        const isHlsReady = hlsStatus[title.id] === "hls_ready";
        const isSelected = selectedIds.includes(title.id);
        const hasPending = (title.type === "SERIES" || title.type === "ANIME") &&
          pendingSummary[title.id]?.pending > 0;

        return (
          <motion.div
            layout
            key={title.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "group relative rounded-2xl bg-zinc-950 border border-white/5 overflow-hidden transition-all duration-500",
              isSelected ? "ring-2 ring-primary border-transparent" : "hover:border-primary/30"
            )}
            onMouseEnter={() => setHoveredId(title.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Selection Checkbox */}
            <div className="absolute top-3 left-3 z-30">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(title.id)}
                className="w-4 h-4 rounded border-white/10 bg-black/40 text-primary focus:ring-primary/50 transition-all cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Status indicators */}
            <div className="absolute top-3 right-3 z-30 flex gap-1.5">
              {isHlsReady ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/90 flex items-center justify-center text-white shadow-lg backdrop-blur-md">
                  <CheckCircle2 size={12} strokeWidth={3} />
                </div>
              ) : hlsStatus[title.id] === "upload_pending" ? (
                <div className="w-6 h-6 rounded-full bg-amber-500/90 flex items-center justify-center text-white shadow-lg backdrop-blur-md">
                  <Clock size={12} strokeWidth={3} />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-800/90 flex items-center justify-center text-zinc-400 shadow-lg backdrop-blur-md">
                  <AlertCircle size={12} strokeWidth={3} />
                </div>
              )}
            </div>

            {/* Poster & Hover Overlay */}
            <div className="aspect-[2/3] relative overflow-hidden bg-zinc-900">
              <img
                src={title.posterUrl || "/placeholder.png"}
                alt={title.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                loading="lazy"
              />

              {/* Cinematic Overlay on Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-4">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => onEdit(title)}
                    className="flex-1 h-9 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-white/10"
                  >
                    <Edit2 size={12} />
                    Editar
                  </button>
                  {(title.type === "SERIES" || title.type === "ANIME") && (
                    <Link
                      href={`/admin/catalog/${title.id}`}
                      className="flex-1 h-9 rounded-lg bg-primary hover:bg-red-700 shadow-lg shadow-primary/20 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                      <Tv size={12} />
                      Obras
                    </Link>
                  )}
                  {title.type === "MOVIE" && !isHlsReady && (
                    <button
                      onClick={() => onTranscode(title.id, title.type)}
                      className="flex-1 h-9 rounded-lg bg-primary hover:bg-red-700 shadow-lg shadow-primary/20 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                      <RefreshCw size={12} />
                      HLS
                    </button>
                  )}
                </div>
                <button
                  onClick={() => onDelete(title.id)}
                  className="w-full h-8 rounded-lg bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-red-500/20"
                >
                  <Trash2 size={10} />
                  Excluir
                </button>
              </div>
            </div>

            {/* Basic Info */}
            <div className="p-4 space-y-2 relative">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-black text-white line-clamp-1 uppercase tracking-wider group-hover:text-primary transition-colors">
                  {title.name}
                </h3>
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="primary" size="sm" className="bg-zinc-900 border-white/5 text-[8px] px-2 py-0.5 font-black uppercase tracking-[0.1em]">
                  {title.type}
                </Badge>
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                  {title.releaseDate?.slice(0, 4) || 'N/A'}
                </span>
              </div>

              {hasPending && (
                <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-amber-500/80">
                  <Clock size={10} />
                  <span>{pendingSummary[title.id].pending} eps pending</span>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
