"use client";

import { useState } from "react";

interface ThumbnailPreviewProps {
  posterUrl: string | null;
  backdropUrl?: string | null;
  title: string;
  size?: "sm" | "md" | "lg";
}

export default function ThumbnailPreview({
  posterUrl,
  backdropUrl,
  title,
  size = "md",
}: ThumbnailPreviewProps) {
  const [showBackdrop, setShowBackdrop] = useState(false);

  const sizeClasses = {
    sm: "h-12 w-8",
    md: "h-16 w-11",
    lg: "h-24 w-16",
  };

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowBackdrop(true)}
      onMouseLeave={() => setShowBackdrop(false)}
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={title}
          className={`${sizeClasses[size]} rounded object-cover shadow-md transition-transform group-hover:scale-105`}
          loading="lazy"
        />
      ) : (
        <div
          className={`${sizeClasses[size]} flex items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500`}
        >
          N/A
        </div>
      )}

      {/* Backdrop Preview on Hover */}
      {showBackdrop && backdropUrl && (
        <div className="absolute left-full top-0 z-50 ml-2 animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
            <img
              src={backdropUrl}
              alt={`${title} backdrop`}
              className="h-32 w-56 rounded object-cover"
              loading="lazy"
            />
            <p className="mt-2 text-xs font-semibold text-zinc-100">{title}</p>
          </div>
        </div>
      )}
    </div>
  );
}
