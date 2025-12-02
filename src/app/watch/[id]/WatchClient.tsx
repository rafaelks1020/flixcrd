"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useRef, useState } from "react";

type TitleType = "MOVIE" | "SERIES" | "ANIME" | "OTHER";

interface TitleData {
  id: string;
  name: string;
  originalName: string | null;
  overview: string | null;
  releaseDate: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  type: TitleType;
}

interface PlaybackResponse {
  playbackUrl: string;
  kind: "hls" | "mp4";
  title: TitleData;
}

interface WatchClientProps {
  titleId: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export default function WatchClient({ titleId }: WatchClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlaybackResponse | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isHovering, setIsHovering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadPlayback() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/titles/${titleId}/playback`);
        const json = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            setError("Você precisa estar logado para assistir.");
          } else {
            setError(json?.error ?? "Erro ao carregar playback.");
          }
          setLoading(false);
          return;
        }

        setData(json as PlaybackResponse);
      } catch (err: any) {
        setError(err.message ?? "Erro ao carregar playback.");
      } finally {
        setLoading(false);
      }
    }

    loadPlayback();
  }, [titleId]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!data?.playbackUrl || !videoRef.current) return;

    const video = videoRef.current;
    const src = data.playbackUrl;
    const kind = data.kind ?? "hls";

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (kind === "mp4") {
      video.src = src;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      video.play().catch(() => {});
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      // best-effort play, ignore falhas automáticas
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      setError("Seu navegador não suporta HLS.");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [data?.playbackUrl]);

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleVolumeChange = (value: number) => {
    const video = videoRef.current;
    const vol = Math.min(1, Math.max(0, value));

    if (video) {
      video.volume = vol;
      video.muted = vol === 0;
    }

    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    const mute = !isMuted;
    video.muted = mute;

    if (!mute && video.volume === 0) {
      video.volume = volume || 0.5;
      setVolume(video.volume);
    }

    setIsMuted(mute);
  };

  const handleSeekBarClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!duration || !videoRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(100, Math.max(0, percent));
    const newTime = (clamped / 100) * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleFullscreenToggle = () => {
    const container = playerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        Carregando player...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-center text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { title } = data;
  const year = title.releaseDate ? title.releaseDate.slice(0, 4) : null;

  return (
    <div className="fixed inset-0 bg-black text-zinc-50">
      <div
        ref={playerRef}
        className="group relative flex h-full w-full items-center justify-center bg-black"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {title.backdropUrl && (
          <div className="pointer-events-none absolute inset-0">
            <img
              src={title.backdropUrl}
              alt={title.name}
              className="h-full w-full object-cover opacity-25"
            />
          </div>
        )}

        <video
          ref={videoRef}
          className="relative z-0 h-full w-full bg-black object-contain"
          poster={title.posterUrl ?? undefined}
          muted={isMuted}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration || 0);
            setVolume(event.currentTarget.volume ?? 1);
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Top bar: voltar + título */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 text-xs md:px-6 md:text-sm">
          <button
            type="button"
            onClick={() => router.back()}
            className="pointer-events-auto rounded-full bg-black/60 px-3 py-1 text-xs text-zinc-100 hover:bg-black/80"
          >
            ← Voltar
          </button>
          <div className="pointer-events-none flex-1 text-center text-[11px] font-medium md:text-xs">
            <span className="opacity-80">
              {year && `${year} · `}
            </span>
            <span>{title.name}</span>
          </div>
          <div className="w-16" />
        </div>

        {/* Buffering indicator */}
        {isBuffering && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
          </div>
        )}

        {/* Play/Pause central */}
        {!loading && !error && (
          <button
            type="button"
            onClick={handleTogglePlay}
            className="pointer-events-auto absolute inset-0 z-30 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-3xl font-semibold text-zinc-50 shadow-xl transition hover:bg-black/80"
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
        )}

        {/* Controles inferiores */}
        <div
          className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-4 pb-4 pt-6 text-xs md:px-6 md:text-sm ${
            isHovering || !isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } transition-opacity`}
        >
          <div
            className="mb-2 h-1.5 w-full cursor-pointer rounded-full bg-zinc-700/80"
            onClick={handleSeekBarClick}
          >
            <div
              className="h-full rounded-full bg-red-600"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!videoRef.current) return;
                const t = Math.max(0, videoRef.current.currentTime - 10);
                videoRef.current.currentTime = t;
                setCurrentTime(t);
              }}
              className="rounded-full bg-black/60 px-2 py-1 text-xs text-zinc-100 hover:bg-black/80"
            >
              ↺ 10s
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white md:text-sm"
            >
              {isPlaying ? "Pausar" : "Assistir"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!videoRef.current || !duration) return;
                const t = Math.min(duration, videoRef.current.currentTime + 10);
                videoRef.current.currentTime = t;
                setCurrentTime(t);
              }}
              className="rounded-full bg-black/60 px-2 py-1 text-xs text-zinc-100 hover:bg-black/80"
            >
              10s ↻
            </button>

            <span className="tabular-nums text-[11px] text-zinc-200 md:text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="ml-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMute}
                className="rounded-full bg-black/60 px-2 py-1 text-xs text-zinc-100 hover:bg-black/80"
              >
                {isMuted || volume === 0 ? "🔇" : "🔊"}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(event) =>
                  handleVolumeChange(Number(event.target.value) / 100)
                }
                className="h-1 w-24 cursor-pointer accent-red-600"
              />
            </div>

            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="ml-auto rounded-full bg-black/60 px-2 py-1 text-xs text-zinc-100 hover:bg-black/80"
            >
              {isFullscreen ? "⤢" : "⛶"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
