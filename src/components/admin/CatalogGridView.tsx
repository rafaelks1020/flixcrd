"use client";

import Link from "next/link";
import { useState } from "react";

interface Title {
  id: string;
  name: string;
  type: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  tmdbId: number | null;
}

interface CatalogGridViewProps {
  titles: Title[];
  hlsStatus: Record<string, string>;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEdit: (title: Title) => void;
  onDelete: (id: string) => void;
  onTranscode: (id: string, type: string) => void;
}

export default function CatalogGridView({
  titles,
  hlsStatus,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  onTranscode,
}: CatalogGridViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {titles.map((title) => (
        <div
          key={title.id}
          className="group relative rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden hover:border-emerald-500/50 transition-all"
          onMouseEnter={() => setHoveredId(title.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {/* Checkbox */}
          <div className="absolute top-2 left-2 z-10">
            <input
              type="checkbox"
              checked={selectedIds.includes(title.id)}
              onChange={() => onToggleSelect(title.id)}
              className="h-4 w-4 accent-emerald-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* HLS Badge */}
          <div className="absolute top-2 right-2 z-10">
            {hlsStatus[title.id] === "hls_ready" ? (
              <span className="inline-flex items-center rounded-md border border-emerald-700 px-2 py-0.5 text-[10px] text-emerald-300 bg-emerald-900/90 backdrop-blur-sm">
                🟢
              </span>
            ) : hlsStatus[title.id] === "upload_pending" ? (
              <span className="inline-flex items-center rounded-md border border-yellow-700 px-2 py-0.5 text-[10px] text-yellow-300 bg-yellow-900/90 backdrop-blur-sm">
                🟡
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500 bg-zinc-900/90 backdrop-blur-sm">
                ⚪
              </span>
            )}
          </div>

          {/* Poster */}
          <div className="aspect-[2/3] relative overflow-hidden bg-zinc-900">
            {title.posterUrl ? (
              <img
                src={title.posterUrl}
                alt={title.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <span className="text-4xl">🎬</span>
              </div>
            )}

            {/* Backdrop Preview on Hover */}
            {hoveredId === title.id && title.backdropUrl && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 animate-in fade-in duration-200">
                <img
                  src={title.backdropUrl}
                  alt={`${title.name} backdrop`}
                  className="w-full h-auto rounded"
                  loading="lazy"
                />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-2 space-y-1">
            <h3 className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-tight">
              {title.name}
            </h3>
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>{title.type}</span>
              {title.releaseDate && (
                <span>{title.releaseDate.slice(0, 4)}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1 pt-1">
              <button
                onClick={() => onEdit(title)}
                className="flex-1 rounded px-2 py-1 text-[10px] bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                title="Editar"
              >
                ✏️
              </button>
              {hlsStatus[title.id] !== "hls_ready" && (
                <button
                  onClick={() => onTranscode(title.id, title.type)}
                  className="flex-1 rounded px-2 py-1 text-[10px] bg-emerald-900/50 text-emerald-300 hover:bg-emerald-900 transition-colors"
                  title="Gerar HLS"
                >
                  🎬
                </button>
              )}
              {(title.type === "SERIES" || title.type === "ANIME") && (
                <Link
                  href={`/admin/catalog/${title.id}`}
                  className="flex-1 rounded px-2 py-1 text-[10px] bg-blue-900/50 text-blue-300 hover:bg-blue-900 transition-colors text-center"
                  title="Temporadas"
                >
                  📺
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
