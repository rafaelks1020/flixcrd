"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, type SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";

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
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeName?: string | null;
}

interface PlaybackResponse {
  playbackUrl: string;
  kind: "hls" | "mp4";
  title: TitleData;
  subtitles?: Array<{
    label: string;
    language?: string | null;
    url: string;
  }>;
}

interface QualityLevelInfo {
  index: number;
  height?: number;
  bitrate?: number;
}

interface WatchClientProps {
  titleId: string;
  episodeId?: string;
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

export default function WatchClient({ titleId, episodeId }: WatchClientProps) {
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
  const [qualityLevels, setQualityLevels] = useState<QualityLevelInfo[]>([]);
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number | null>(null);
  const [autoQuality, setAutoQuality] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<TextTrack[]>([]);
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState<number | null>(null);
  const [useCloudflareProxy, setUseCloudflareProxy] = useState<boolean | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [nextEpisode, setNextEpisode] = useState<{ id: string; name: string; episodeNumber: number; seasonNumber: number } | null>(null);
  const [showNextEpisodeCountdown, setShowNextEpisodeCountdown] = useState(false);
  const [countdown, setCountdown] = useState(10);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressSyncRef = useRef<number>(0);
  const router = useRouter();

  // Carrega o profileId ativo salvo pelo fluxo de perfis
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("activeProfileId");
    setProfileId(stored ?? null);
  }, []);

  useEffect(() => {
    async function testarVelocidadeCloudflare(): Promise<number> {
      // Testa a velocidade do Cloudflare Worker (Wasabi)
      // Se der erro ou demorar muito, usa direto
      if (typeof performance === "undefined" || typeof fetch === "undefined") {
        return Infinity;
      }

      const inicio = performance.now();
      try {
        // Tenta acessar um arquivo pequeno via Cloudflare Worker (Wasabi)
        const testUrl = "https://hlspaelflix.top/titles/a-nevoa-da-guerra/seg_0003.ts";
        await fetch(testUrl, {
          method: "HEAD",
          cache: "no-store",
        });
      } catch {
        return Infinity; // Erro = Cloudflare offline/inacessível
      }
      return performance.now() - inicio;
    }

    async function loadPlayback() {
      setLoading(true);
      setError(null);
      try {
        // 1) Buscar configuração do perfil
        let proxyFlag = false;
        if (profileId) {
          try {
            const profileRes = await fetch(
              `/api/profiles/${encodeURIComponent(profileId)}`,
              { cache: "no-store" },
            );
            if (profileRes.ok) {
              const profileJson = await profileRes.json();
              proxyFlag = Boolean(profileJson?.useCloudflareProxy);
            }
          } catch {
            proxyFlag = false;
          }
        }
        setUseCloudflareProxy(proxyFlag);

        // 2) Decidir origem: SEMPRE Cloudflare primeiro se o toggle estiver ativo
        let source: "direct" | "cloudflare" = "direct";
        if (proxyFlag) {
          // Testa se Cloudflare está respondendo bem
          const tempo = await testarVelocidadeCloudflare();
          const limite = 300; // ms - se demorar mais ou falhar, usa acesso direto
          if (tempo <= limite) {
            source = "cloudflare"; // Cloudflare OK, usa ele
          } else {
            source = "direct"; // Cloudflare lento/off, usa direto
          }
        }

        const baseUrl = episodeId
          ? `/api/episodes/${episodeId}/playback`
          : `/api/titles/${titleId}/playback`;
        const sep = baseUrl.includes("?") ? "&" : "?";
        const url = `${baseUrl}${sep}source=${source}`;

        const res = await fetch(url);
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
  }, [titleId, episodeId, profileId]);

  // Buscar próximo episódio se for série/anime
  useEffect(() => {
    async function fetchNextEpisode() {
      if (!episodeId || !data) return;
      
      try {
        const res = await fetch(`/api/titles/${titleId}/seasons`);
        if (!res.ok) return;
        
        const seasons = await res.json();
        
        // Encontrar episódio atual
        let currentSeason: any = null;
        let currentEp: any = null;
        
        for (const season of seasons) {
          const ep = season.episodes?.find((e: any) => e.id === episodeId);
          if (ep) {
            currentSeason = season;
            currentEp = ep;
            break;
          }
        }
        
        if (!currentEp || !currentSeason) return;
        
        // Buscar próximo episódio na mesma temporada
        const nextEpInSeason = currentSeason.episodes?.find(
          (e: any) => e.episodeNumber === currentEp.episodeNumber + 1
        );
        
        if (nextEpInSeason) {
          setNextEpisode({
            id: nextEpInSeason.id,
            name: nextEpInSeason.name,
            episodeNumber: nextEpInSeason.episodeNumber,
            seasonNumber: currentSeason.seasonNumber,
          });
          return;
        }
        
        // Se não houver, buscar primeiro episódio da próxima temporada
        const nextSeason = seasons.find(
          (s: any) => s.seasonNumber === currentSeason.seasonNumber + 1
        );
        
        if (nextSeason && nextSeason.episodes?.length > 0) {
          const firstEp = nextSeason.episodes[0];
          setNextEpisode({
            id: firstEp.id,
            name: firstEp.name,
            episodeNumber: firstEp.episodeNumber,
            seasonNumber: nextSeason.seasonNumber,
          });
        }
      } catch (err) {
        console.error('Erro ao buscar próximo episódio:', err);
      }
    }
    
    fetchNextEpisode();
  }, [titleId, episodeId, data]);

  // Countdown e autoplay para próximo episódio
  useEffect(() => {
    if (!showNextEpisodeCountdown || !nextEpisode) return;
    
    if (countdown === 0) {
      // Ir para próximo episódio
      router.push(`/watch/${titleId}?episodeId=${nextEpisode.id}`);
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [showNextEpisodeCountdown, countdown, nextEpisode, titleId, router]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setIsHovering((prev) => {
      if (prev) return prev; // Já está true, não precisa atualizar
      return true;
    });
    
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    
    if (isPlaying) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setIsHovering(false);
      }, 3000);
    }
  }, [isPlaying]);

  const handleTrackLoad = (event: SyntheticEvent<HTMLTrackElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const tracks = Array.from(video.textTracks || []);
    // eslint-disable-next-line no-console
    console.log("[WatchClient] track load", {
      loadedLabel: event.currentTarget.label,
      loadedSrc: event.currentTarget.src,
      tracks: tracks.map((t) => ({
        label: t.label,
        language: t.language,
        kind: t.kind,
        mode: t.mode,
        cues: t.cues?.length ?? 0,
      })),
    });

    let defaultIndex: number | null = null;
    if (tracks.length === 1) {
      defaultIndex = 0;
    } else {
      const ptIndex = tracks.findIndex((t) => {
        const lang = (t.language || "").toLowerCase();
        const label = (t.label || "").toLowerCase();
        return lang.startsWith("pt") || label.includes("pt");
      });
      if (ptIndex >= 0) {
        defaultIndex = ptIndex;
      }
    }

    tracks.forEach((track, index) => {
      // eslint-disable-next-line no-param-reassign
      track.mode = defaultIndex !== null && index === defaultIndex ? "showing" : "hidden";
    });

    setSubtitleTracks(tracks);
    setCurrentSubtitleIndex(defaultIndex);
  };

  const handleMouseMove = () => {
    showControlsTemporarily();
  };

  const handleMouseLeave = () => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    setIsHovering(false);
  };

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
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data: any) => {
        const levelsArray = Array.isArray(data?.levels) ? data.levels : [];
        const mapped: QualityLevelInfo[] = levelsArray.map((level: any, index: number) => ({
          index,
          height: typeof level?.height === "number" ? level.height : undefined,
          bitrate: typeof level?.bitrate === "number" ? level.bitrate : undefined,
        }));
        setQualityLevels(mapped);
        if (hls.currentLevel >= 0) {
          setCurrentLevelIndex(hls.currentLevel);
        } else {
          setCurrentLevelIndex(null);
        }
        setAutoQuality(Boolean(hls.autoLevelEnabled));
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data: any) => {
        if (typeof data?.level === "number") {
          setCurrentLevelIndex(data.level);
        }
      });
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

  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const video = videoRef.current;
      if (!video) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const editable = target.getAttribute("contenteditable");
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          editable === "" ||
          editable === "true"
        ) {
          return;
        }
      }

      const key = event.key;

      if (key === " " || key === "k" || key === "K") {
        event.preventDefault();
        if (video.paused || video.ended) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        return;
      }

      if (key === "ArrowLeft" || key === "j" || key === "J") {
        event.preventDefault();
        if (duration) {
          const t = Math.max(0, (video.currentTime || 0) - 10);
          video.currentTime = t;
          setCurrentTime(t);
        }
        return;
      }

      if (key === "ArrowRight" || key === "l" || key === "L") {
        event.preventDefault();
        if (duration) {
          const t = Math.min(duration, (video.currentTime || 0) + 10);
          video.currentTime = t;
          setCurrentTime(t);
        }
        return;
      }

      if (key === "ArrowUp") {
        event.preventDefault();
        const next = Math.min(1, volume + 0.05);
        video.volume = next;
        video.muted = next === 0;
        setVolume(next);
        setIsMuted(next === 0);
        return;
      }

      if (key === "ArrowDown") {
        event.preventDefault();
        const next = Math.max(0, volume - 0.05);
        video.volume = next;
        video.muted = next === 0;
        setVolume(next);
        setIsMuted(next === 0);
        return;
      }

      if (key === "m" || key === "M") {
        event.preventDefault();
        const newMuted = !isMuted;
        video.muted = newMuted;
        if (!newMuted && video.volume === 0) {
          const restored = volume || 0.5;
          video.volume = restored;
          setVolume(restored);
        }
        setIsMuted(newMuted);
        return;
      }

      if (key === "f" || key === "F") {
        event.preventDefault();
        const container = playerRef.current;
        if (!container) return;
        if (!document.fullscreenElement) {
          container.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
        return;
      }

      if (key >= "0" && key <= "9") {
        if (!duration) return;
        event.preventDefault();
        const digit = Number(key);
        const targetPercent = digit * 10;
        const newTime = (targetPercent / 100) * duration;
        video.currentTime = newTime;
        setCurrentTime(newTime);
        return;
      }

      if (key === "?" || key === "h" || key === "H") {
        event.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [duration, volume, isMuted]);

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
  const displayName = title.episodeName || title.name;
  const episodeLabel =
    typeof title.seasonNumber === "number" && typeof title.episodeNumber === "number"
      ? `S${String(title.seasonNumber).padStart(2, "0")}E${String(
          title.episodeNumber,
        ).padStart(2, "0")}`
      : null;

  return (
    <div className="fixed inset-0 bg-black text-zinc-50">
      <div
        ref={playerRef}
        className="group relative flex h-full w-full items-center justify-center bg-black"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
          crossOrigin="anonymous"
          onLoadedMetadata={(event) => {
            const videoEl = event.currentTarget;
            const loadedDuration = videoEl.duration || 0;
            setDuration(loadedDuration);
            setVolume(videoEl.volume ?? 1);

            const tracks = Array.from(event.currentTarget.textTracks || []);
            // Debug rápido para garantir que as tracks estão sendo detectadas
            // eslint-disable-next-line no-console
            console.log("[WatchClient] textTracks", tracks.map((t) => ({
              label: t.label,
              language: t.language,
              kind: t.kind,
              mode: t.mode,
              cues: t.cues?.length ?? 0,
            })));

            let defaultIndex: number | null = null;
            if (tracks.length === 1) {
              defaultIndex = 0;
            } else if (tracks.length > 1) {
              const ptIndex = tracks.findIndex((t) => {
                const lang = (t.language || "").toLowerCase();
                const label = (t.label || "").toLowerCase();
                return lang.startsWith("pt") || label.includes("pt");
              });
              if (ptIndex >= 0) {
                defaultIndex = ptIndex;
              }
            }

            tracks.forEach((track, index) => {
              // Mantém legendas ocultas por padrão, mas se houver apenas uma faixa, já a exibe.
              // eslint-disable-next-line no-param-reassign
              track.mode = defaultIndex !== null && index === defaultIndex ? "showing" : "hidden";
            });
            setSubtitleTracks(tracks);
            setCurrentSubtitleIndex(defaultIndex);

            // Buscar progresso salvo para Continuar assistindo
            if (profileId) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              (async () => {
                try {
                  const baseUrl = episodeId
                    ? `/api/titles/${titleId}/progress?episodeId=${encodeURIComponent(episodeId)}`
                    : `/api/titles/${titleId}/progress`;

                  const sep = baseUrl.includes("?") ? "&" : "?";
                  const progressUrl = `${baseUrl}${sep}profileId=${encodeURIComponent(profileId)}`;

                  const res = await fetch(progressUrl);
                  if (!res.ok) return;
                  const json = await res.json();
                  const resume = Number(json?.positionSeconds ?? 0);
                  const total = Number(json?.durationSeconds ?? loadedDuration ?? 0);
                  const effectiveDuration = total || loadedDuration;
                  if (
                    Number.isFinite(resume) &&
                    resume > 0 &&
                    effectiveDuration &&
                    resume < effectiveDuration - 5
                  ) {
                    videoEl.currentTime = resume;
                    setCurrentTime(resume);
                  }
                } catch {
                  // ignora erros de progresso
                }
              })();
            }
          }}
          onTimeUpdate={(event) => {
            const videoEl = event.currentTarget;
            const newTime = videoEl.currentTime;
            const total = videoEl.duration || duration;
            setCurrentTime(newTime);

            const now = Date.now();
            if (
              profileId &&
              total &&
              Number.isFinite(total) &&
              now - lastProgressSyncRef.current > 5000
            ) {
              lastProgressSyncRef.current = now;
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              fetch(`/api/titles/${titleId}/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  positionSeconds: newTime,
                  durationSeconds: total,
                  episodeId: episodeId ?? null,
                  profileId,
                }),
              }).catch(() => {
                // ignora erro de rede
              });
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={(event) => {
            setIsPlaying(false);
            const videoEl = event.currentTarget;
            const total = videoEl.duration || duration;
            const pos = videoEl.currentTime;
            if (!total || !Number.isFinite(total)) return;
            if (!profileId) return;
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fetch(`/api/titles/${titleId}/progress`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                positionSeconds: pos,
                durationSeconds: total,
                episodeId: episodeId ?? null,
                profileId,
              }),
            }).catch(() => {});
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={(event) => {
            setIsPlaying(false);
            const videoEl = event.currentTarget;
            const total = videoEl.duration || duration;
            if (!total || !Number.isFinite(total)) return;
            if (!profileId) return;
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fetch(`/api/titles/${titleId}/progress`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                positionSeconds: total,
                durationSeconds: total,
                episodeId: episodeId ?? null,
                profileId,
              }),
            }).catch(() => {});
            
            // Mostrar countdown para próximo episódio
            if (nextEpisode) {
              setShowNextEpisodeCountdown(true);
              setCountdown(10);
            }
          }}
        >
          {data.subtitles?.map((sub, index) => (
            <track
              // eslint-disable-next-line react/no-array-index-key
              key={`${sub.url}-${index}`}
              kind="subtitles"
              src={sub.url}
              srcLang={sub.language ?? undefined}
              label={sub.label}
              default={index === 0}
              onLoad={handleTrackLoad}
            />
          ))}
        </video>

        {/* Top bar: voltar + título */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 text-xs md:px-6 md:text-sm transition-opacity ${
            isHovering || !isPlaying ? "opacity-100" : "opacity-0"
          }`}
        >
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
            <span>
              {episodeLabel ? `${episodeLabel} · ${displayName}` : displayName}
            </span>
          </div>
          <div className="w-16" />
        </div>

        {/* Buffering indicator */}
        {isBuffering && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
          </div>
        )}

        {/* Countdown Overlay para Próximo Episódio */}
        {showNextEpisodeCountdown && nextEpisode && (
          <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="mb-6">
                <div className="text-6xl font-bold text-white mb-4">{countdown}</div>
                <p className="text-xl text-zinc-300 mb-2">Próximo episódio em...</p>
                <p className="text-lg text-zinc-400">
                  S{nextEpisode.seasonNumber.toString().padStart(2, '0')}E{nextEpisode.episodeNumber.toString().padStart(2, '0')} - {nextEpisode.name}
                </p>
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => router.push(`/watch/${titleId}?episodeId=${nextEpisode.id}`)}
                  className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 flex items-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Assistir Agora
                </button>
                <button
                  onClick={() => {
                    setShowNextEpisodeCountdown(false);
                    setCountdown(10);
                  }}
                  className="rounded-lg bg-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Play/Pause central */}
        {!loading && !error && (!isPlaying || isHovering) && !showNextEpisodeCountdown && (
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
          className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-4 pb-4 pt-6 text-xs md:px-6 md:text-sm transition-opacity ${
            isHovering || !isPlaying ? "opacity-100" : "opacity-0"
          }`}
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

            {/* Botão Próximo Episódio */}
            {nextEpisode && (
              <button
                type="button"
                onClick={() => router.push(`/watch/${titleId}?episodeId=${nextEpisode.id}`)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 md:text-sm flex items-center gap-2"
                title={`S${nextEpisode.seasonNumber.toString().padStart(2, '0')}E${nextEpisode.episodeNumber.toString().padStart(2, '0')} - ${nextEpisode.name}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                  <path d="M19 5v14" strokeWidth="2" stroke="currentColor" />
                </svg>
                Próximo
              </button>
            )}

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

            {qualityLevels.length > 0 && hlsRef.current && (
              <select
                value={autoQuality ? "auto" : String(currentLevelIndex ?? -1)}
                onChange={(event) => {
                  const value = event.target.value;
                  const hls = hlsRef.current;
                  if (!hls) return;
                  if (value === "auto") {
                    hls.currentLevel = -1;
                    // eslint-disable-next-line no-param-reassign
                    hls.autoLevelEnabled = true;
                    setAutoQuality(true);
                    return;
                  }
                  const levelIndex = Number(value);
                  if (Number.isNaN(levelIndex)) return;
                  hls.currentLevel = levelIndex;
                  // eslint-disable-next-line no-param-reassign
                  hls.autoLevelEnabled = false;
                  setCurrentLevelIndex(levelIndex);
                  setAutoQuality(false);
                }}
                className="ml-3 rounded-md border border-zinc-700 bg-black/60 px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-zinc-500"
              >
                {qualityLevels.length > 1 && <option value="auto">Auto</option>}
                {qualityLevels.map((level) => {
                  const labelParts: string[] = [];
                  if (typeof level.height === "number" && level.height > 0) {
                    labelParts.push(`${level.height}p`);
                  }
                  if (typeof level.bitrate === "number" && level.bitrate > 0) {
                    const mbps = level.bitrate / 1000000;
                    labelParts.push(`${mbps.toFixed(1)} Mbps`);
                  }
                  const label = labelParts.length > 0 ? labelParts.join(" · ") : "Qualidade";
                  return (
                    <option key={level.index} value={level.index}>
                      {label}
                    </option>
                  );
                })}
              </select>
            )}

            {subtitleTracks.length > 0 && (
              <select
                value={currentSubtitleIndex ?? -1}
                onChange={(event) => {
                  const index = Number(event.target.value);
                  const tracks = subtitleTracks;
                  tracks.forEach((track, i) => {
                    // eslint-disable-next-line no-param-reassign
                    track.mode = i === index ? "showing" : "hidden";
                  });
                  setCurrentSubtitleIndex(Number.isNaN(index) || index < 0 ? null : index);
                }}
                className="ml-3 rounded-md border border-zinc-700 bg-black/60 px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-zinc-500"
              >
                <option value={-1}>Sem legendas</option>
                {subtitleTracks.map((track, index) => {
                  const label = track.label || track.language || `Legenda ${index + 1}`;
                  return (
                    // eslint-disable-next-line react/no-array-index-key
                    <option key={index} value={index}>
                      {label}
                    </option>
                  );
                })}
              </select>
            )}

            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="ml-auto rounded-full bg-black/60 px-2 py-1 text-xs text-zinc-100 hover:bg-black/80"
            >
              {isFullscreen ? "⤢" : "⛶"}
            </button>
          </div>
        </div>

        {showShortcuts && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-end p-4">
            <div className="pointer-events-auto max-w-xs rounded-md bg-black/80 p-3 text-[11px] text-zinc-200 shadow-lg">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">Atalhos do player</span>
                <button
                  type="button"
                  onClick={() => setShowShortcuts(false)}
                  className="ml-2 rounded px-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  fechar
                </button>
              </div>
              <ul className="space-y-0.5">
                <li>
                  <span className="font-mono">Barra de espaço / K</span> – play / pause
                </li>
                <li>
                  <span className="font-mono">← / J</span> – voltar 10s
                </li>
                <li>
                  <span className="font-mono">→ / L</span> – avançar 10s
                </li>
                <li>
                  <span className="font-mono">↑ / ↓</span> – volume ±
                </li>
                <li>
                  <span className="font-mono">M</span> – mutar / desmutar
                </li>
                <li>
                  <span className="font-mono">F</span> – fullscreen
                </li>
                <li>
                  <span className="font-mono">0–9</span> – ir para 0–90% do vídeo
                </li>
                <li>
                  <span className="font-mono">?/H</span> – mostrar/ocultar esta ajuda
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
