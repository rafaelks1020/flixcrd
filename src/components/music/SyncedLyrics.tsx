"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Mic2 } from "lucide-react";
import { getCurrentLrcLine, parseLrc, type LrcLine } from "@/lib/music/lrc-parser";

type SyncedLyricsProps = {
  lyricsLrc: string | null;
  lyricsPlain?: string | null;
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (time: number) => void;
};

export function SyncedLyrics({ lyricsLrc, lyricsPlain, currentTime, isPlaying, onSeek }: SyncedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selfScrollRef = useRef(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const { lines, isSynced } = useMemo(() => {
    if (lyricsLrc) {
      const parsed = parseLrc(lyricsLrc);
      if (parsed.lines.length > 0) return { lines: parsed.lines, isSynced: true };
    }
    if (lyricsPlain) {
      const plainLines = lyricsPlain
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((text, index) => ({ time: index * 4, text }));
      return { lines: plainLines, isSynced: false };
    }
    return { lines: [] as LrcLine[], isSynced: false };
  }, [lyricsLrc, lyricsPlain]);

  const currentLineIndex = useMemo(() => {
    if (!isSynced) return -1;
    return getCurrentLrcLine(lines, currentTime);
  }, [lines, currentTime, isSynced]);

  const lineProgress = useMemo(() => {
    if (!isSynced || currentLineIndex < 0 || currentLineIndex >= lines.length - 1) return 1;
    const currentLine = lines[currentLineIndex];
    const nextLine = lines[currentLineIndex + 1];
    const lineDuration = nextLine.time - currentLine.time;
    if (lineDuration <= 0) return 1;
    return Math.min(1, Math.max(0, (currentTime - currentLine.time) / lineDuration));
  }, [lines, currentLineIndex, currentTime, isSynced]);

  useEffect(() => {
    if (!autoScroll || currentLineIndex < 0) return;
    const container = containerRef.current;
    const lineElement = container?.querySelector(`[data-line-index="${currentLineIndex}"]`);
    if (!lineElement) return;
    selfScrollRef.current = true;
    lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => { selfScrollRef.current = false; }, 700);
    return () => window.clearTimeout(timer);
  }, [currentLineIndex, autoScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let timer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      if (selfScrollRef.current) return;
      setAutoScroll(false);
      clearTimeout(timer);
      timer = setTimeout(() => setAutoScroll(true), 3000);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(timer);
    };
  }, []);

  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-zinc-500">
        <FileText size={40} className="mb-3 opacity-40" />
        <div className="text-sm">Letra não disponível</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-4 py-8">
      {!isSynced && (
        <div className="mb-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <FileText size={12} />
          <span>Letra sem sincronização</span>
        </div>
      )}
      <div className="space-y-4 pb-[50%] pt-[30%]">
        {lines.map((line, index) => {
          const isCurrent = index === currentLineIndex;
          const isPast = index < currentLineIndex;
          return (
            <button
              key={`${index}-${line.time}`}
              type="button"
              data-line-index={index}
              onClick={() => isSynced && onSeek?.(line.time)}
              disabled={!isSynced}
              className={`relative block w-full text-left transition-all duration-300 ${
                isCurrent
                  ? "origin-left scale-105 text-2xl font-black sm:text-3xl"
                  : isPast
                    ? "text-base text-white/40 sm:text-lg"
                    : "text-base text-white/25 hover:text-white/50 sm:text-lg"
              } ${isSynced ? "cursor-pointer" : "cursor-default"}`}
            >
              {isCurrent && isSynced ? (
                <span className="relative inline">
                  <span className="text-white/30">{line.text || "♪"}</span>
                  <span
                    className="absolute left-0 top-0 text-fuchsia-300"
                    style={{ clipPath: `inset(0 ${100 - lineProgress * 100}% 0 0)` }}
                  >
                    {line.text || "♪"}
                  </span>
                </span>
              ) : (
                <span className={isCurrent ? "text-fuchsia-300" : ""}>{line.text || "♪"}</span>
              )}
              {isCurrent && isSynced && isPlaying && (
                <Mic2 size={16} className="ml-2 inline-block animate-pulse text-fuchsia-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
