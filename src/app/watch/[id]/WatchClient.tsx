"use client";

import Hls from "hls.js";

// Tipos para eventos HLS
interface HlsLevelData {
  level: number;
}

interface HlsManifestData {
  levels: Array<{ height?: number; bitrate?: number }>;
}

interface HlsErrorData {
  type: string;
  details: string;
  fatal?: boolean;
  response?: { code?: number };
}
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
  expiresAt?: number | null;
  protected?: boolean;
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
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [isProtectedStream, setIsProtectedStream] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [bufferHealth, setBufferHealth] = useState<"low" | "medium" | "high">("medium");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressSyncRef = useRef<number>(0);
  const progressSyncInFlightRef = useRef<boolean>(false);
  const lastSyncedPositionRef = useRef<number>(-1);
  const pendingProgressRef = useRef<{ positionSeconds: number; durationSeconds: number } | null>(null);
  const tokenRenewalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingPlaybackRef = useRef<boolean>(false); // Evitar chamadas duplicadas
  const isRenewingTokenRef = useRef<boolean>(false); // Evitar renovações duplicadas
  const savedPositionRef = useRef<number>(0); // Salvar posição ao renovar token
  const currentStreamUrlRef = useRef<string | null>(null); // URL atual do stream (para renovação silenciosa)
  const bufferIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRestoredProgressRef = useRef<boolean>(false); // Evitar múltiplas restaurações de progresso
  const router = useRouter();

  const flushProgressQueue = useCallback(async () => {
    if (progressSyncInFlightRef.current) return;
    if (!profileId) return;
    const pending = pendingProgressRef.current;
    if (!pending) return;

    progressSyncInFlightRef.current = true;
    pendingProgressRef.current = null;

    try {
      await fetch(`/api/titles/${titleId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionSeconds: pending.positionSeconds,
          durationSeconds: pending.durationSeconds,
          episodeId: episodeId ?? null,
          profileId,
        }),
        keepalive: true,
      });

      lastSyncedPositionRef.current = pending.positionSeconds;
    } catch {
    } finally {
      progressSyncInFlightRef.current = false;
      if (pendingProgressRef.current) {
        void flushProgressQueue();
      }
    }
  }, [episodeId, profileId, titleId]);

  const queueProgressSync = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      if (!profileId) return;
      if (!durationSeconds || !Number.isFinite(durationSeconds)) return;

      const pos = Math.max(0, Math.floor(positionSeconds));
      const dur = Math.max(0, Math.floor(durationSeconds));

      const lastPos = lastSyncedPositionRef.current;
      if (lastPos >= 0 && Math.abs(pos - lastPos) < 3) return;

      pendingProgressRef.current = { positionSeconds: pos, durationSeconds: dur };
      void flushProgressQueue();
    },
    [flushProgressQueue, profileId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const flush = () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;

      const total = videoEl.duration || duration;
      if (!profileId) return;
      if (!total || !Number.isFinite(total)) return;

      const pos = videoEl.currentTime;
      const payload = JSON.stringify({
        positionSeconds: pos,
        durationSeconds: total,
        episodeId: episodeId ?? null,
        profileId,
      });

      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          navigator.sendBeacon(
            `/api/titles/${titleId}/progress`,
            new Blob([payload], { type: "application/json" }),
          );
          lastSyncedPositionRef.current = Math.max(0, Math.floor(pos));
          return;
        } catch {
        }
      }

      queueProgressSync(pos, total);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [duration, episodeId, profileId, queueProgressSync, titleId]);

  const titleMeta = data?.title;
  const mediaTitle = titleMeta?.episodeName || titleMeta?.name || "Pflix";
  const mediaSubtitle =
    typeof titleMeta?.seasonNumber === "number" && typeof titleMeta?.episodeNumber === "number"
      ? `S${String(titleMeta.seasonNumber).padStart(2, "0")}E${String(titleMeta.episodeNumber).padStart(2, "0")}`
      : undefined;

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ms = (navigator as any).mediaSession;
    if (!ms) return;
    if (!titleMeta) return;

    try {
      const MediaMetadataCtor = (window as any).MediaMetadata;
      if (typeof MediaMetadataCtor === "function") {
        ms.metadata = new MediaMetadataCtor({
          title: mediaTitle,
          artist: mediaSubtitle || "",
          album: "Pflix",
          artwork: titleMeta.posterUrl
            ? [
                { src: titleMeta.posterUrl, sizes: "512x512", type: "image/png" },
                { src: titleMeta.posterUrl, sizes: "384x384", type: "image/png" },
                { src: titleMeta.posterUrl, sizes: "192x192", type: "image/png" },
              ]
            : undefined,
        });
      }
    } catch {
    }

    const safeSetHandler = (action: string, handler: any) => {
      try {
        ms.setActionHandler?.(action, handler);
      } catch {
      }
    };

    safeSetHandler("play", async () => {
      const v = videoRef.current;
      if (!v) return;
      await v.play().catch(() => {});
    });
    safeSetHandler("pause", () => {
      const v = videoRef.current;
      if (!v) return;
      v.pause();
    });
    safeSetHandler("seekbackward", (details: any) => {
      const v = videoRef.current;
      if (!v) return;
      const offset = Number(details?.seekOffset ?? 10);
      v.currentTime = Math.max(0, (v.currentTime || 0) - offset);
    });
    safeSetHandler("seekforward", (details: any) => {
      const v = videoRef.current;
      if (!v) return;
      const offset = Number(details?.seekOffset ?? 10);
      v.currentTime = Math.min(v.duration || Infinity, (v.currentTime || 0) + offset);
    });
    safeSetHandler("seekto", (details: any) => {
      const v = videoRef.current;
      if (!v) return;
      const t = Number(details?.seekTime);
      if (!Number.isFinite(t)) return;
      v.currentTime = t;
    });
  }, [mediaSubtitle, mediaTitle, titleMeta]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ms = (navigator as any).mediaSession;
    if (!ms?.setPositionState) return;
    if (!Number.isFinite(duration) || duration <= 0) return;

    try {
      const v = videoRef.current;
      const rate = v?.playbackRate ?? 1;
      ms.setPositionState({
        duration,
        position: Math.max(0, Math.min(duration, currentTime || 0)),
        playbackRate: rate,
      });
    } catch {
    }
  }, [currentTime, duration]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (typeof document === "undefined") return;

    const release = async () => {
      try {
        await wakeLockRef.current?.release?.();
      } catch {
      } finally {
        wakeLockRef.current = null;
      }
    };

    const request = async () => {
      if (!isPlaying) return;
      if (document.visibilityState !== "visible") return;
      if (!(navigator as any).wakeLock?.request) return;
      if (wakeLockRef.current) return;

      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        wakeLockRef.current?.addEventListener?.("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void request();
      } else {
        void release();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    void request();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, [isPlaying]);

  // Detectar tipo de dispositivo para ajustar buffer
  const getDeviceType = useCallback((): "xbox" | "mobile" | "tv" | "desktop" => {
    if (typeof navigator === "undefined") return "desktop";
    
    const ua = navigator.userAgent.toLowerCase();
    
    // Xbox tem memória limitada - buffer pequeno
    if (ua.includes("xbox") || ua.includes("xboxone") || ua.includes("xbox series")) {
      return "xbox";
    }
    
    // Smart TVs geralmente têm memória limitada
    if (ua.includes("smart-tv") || ua.includes("smarttv") || ua.includes("webos") || 
        ua.includes("tizen") || ua.includes("roku") || ua.includes("firetv") ||
        ua.includes("appletv") || ua.includes("chromecast")) {
      return "tv";
    }
    
    // Mobile também tem limitações
    if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      return "mobile";
    }
    
    return "desktop";
  }, []);

  // Medir velocidade de download para ajustar buffer
  const measureNetworkSpeed = useCallback(async (): Promise<number> => {
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as any).connection;
      if (conn?.downlink) {
        // downlink está em Mbps
        return conn.downlink;
      }
    }
    
    // Fallback: assumir velocidade média
    return 10; // 10 Mbps default
  }, []);

  // Calcular configuração de buffer baseado no dispositivo e velocidade
  const getBufferConfig = useCallback((deviceType: string, speedMbps: number) => {
    // Configurações base por dispositivo (em segundos)
    const configs = {
      // Xbox: buffer pequeno para evitar travamentos de memória
      xbox: {
        maxBufferLength: 30,        // Máximo 30s de buffer
        maxMaxBufferLength: 60,     // Nunca mais que 60s
        backBufferLength: 10,       // Manter só 10s atrás
      },
      // TV: buffer moderado
      tv: {
        maxBufferLength: 45,
        maxMaxBufferLength: 90,
        backBufferLength: 15,
      },
      // Mobile: buffer médio
      mobile: {
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        backBufferLength: 20,
      },
      // Desktop: buffer grande se a internet permitir
      desktop: {
        maxBufferLength: 120,       // 2 minutos de buffer
        maxMaxBufferLength: 300,    // Até 5 minutos se internet boa
        backBufferLength: 30,       // Manter 30s atrás
      },
    };

    const baseConfig = configs[deviceType as keyof typeof configs] || configs.desktop;
    
    // Ajustar baseado na velocidade da internet
    let multiplier = 1;
    if (speedMbps < 5) {
      multiplier = 0.5; // Internet lenta: reduzir buffer
    } else if (speedMbps < 15) {
      multiplier = 0.75; // Internet média
    } else if (speedMbps > 50) {
      multiplier = 1.5; // Internet rápida: aumentar buffer
    }
    
    // Para Xbox, nunca aumentar além do limite
    if (deviceType === "xbox") {
      multiplier = Math.min(multiplier, 1);
    }

    return {
      maxBufferLength: Math.round(baseConfig.maxBufferLength * multiplier),
      maxMaxBufferLength: Math.round(baseConfig.maxMaxBufferLength * multiplier),
      backBufferLength: baseConfig.backBufferLength,
    };
  }, []);

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
        // Tenta acessar a API de status do Cloudflare
        const res = await fetch("/api/status/cloudflare", { cache: "no-store" });
        if (!res.ok) return Infinity;
      } catch {
        return Infinity; // Erro = Cloudflare offline/inacessível
      }
      return performance.now() - inicio;
    }

    async function loadPlayback() {
      // Evitar chamadas duplicadas (React Strict Mode)
      if (isLoadingPlaybackRef.current) {
        console.log("[WatchClient] loadPlayback já em execução, ignorando...");
        return;
      }
      isLoadingPlaybackRef.current = true;
      
      setLoading(true);
      setError(null);
      setSubscriptionBlocked(false);
      
      try {
        // 0) Verificar assinatura antes de carregar o vídeo
        const subRes = await fetch('/api/subscription/check');
        const subData = await subRes.json();
        
        if (!subData.canWatch) {
          setSubscriptionBlocked(true);
          setLoading(false);
          return;
        }
        
        // 1) Buscar configuração do perfil
        let proxyFlag = false;
        if (profileId) {
          try {
            const profileRes = await fetch(
              `/api/profiles/${encodeURIComponent(profileId)}`,
              { cache: "no-store" },
            );
            if (profileRes.status === 404) {
              if (typeof window !== "undefined") {
                window.localStorage.removeItem("activeProfileId");
              }
              setProfileId(null);
              setError("Seu perfil selecionado não existe mais. Escolha um perfil novamente.");
              setLoading(false);
              router.push("/profiles");
              return;
            }
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

        const playbackData = json as PlaybackResponse;
        setData(playbackData);
        
        // Configurar renovação de token se for streaming protegido
        if (playbackData.protected && playbackData.expiresAt) {
          setIsProtectedStream(true);
          setTokenExpiresAt(playbackData.expiresAt);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar playback.");
      } finally {
        setLoading(false);
        // Não resetar isLoadingPlaybackRef aqui para evitar re-chamadas
      }
    }

    loadPlayback();
    
    // Cleanup: resetar flags quando componente desmontar ou deps mudarem
    return () => {
      isLoadingPlaybackRef.current = false;
      hasRestoredProgressRef.current = false; // Resetar para permitir nova restauração
    };
  }, [titleId, episodeId, profileId]);

  // Função para renovar token silenciosamente (SEM recarregar o player)
  // A nova estratégia: apenas atualizar a referência da URL para uso futuro
  // O HLS.js continua usando os segmentos já carregados no buffer
  // Só recarrega se houver erro 403 (token expirado no meio do stream)
  const renewTokenAndUpdatePlayer = useCallback(async (forceReload = false) => {
    if (isRenewingTokenRef.current) {
      console.log("[WatchClient] Renovação já em andamento, ignorando...");
      return;
    }
    
    isRenewingTokenRef.current = true;
    
    try {
      console.log("[WatchClient] Renovando token de streaming...");
      
      const contentType = episodeId ? "episode" : "title";
      const contentId = episodeId || titleId;
      
      const res = await fetch("/api/stream/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId }),
      });

      if (!res.ok) {
        console.error("[WatchClient] Erro ao renovar token:", res.status);
        return;
      }

      const newData = await res.json();
      
      if (newData.streamUrl && newData.expiresAt) {
        const expiresInMinutes = Math.round((newData.expiresAt - Date.now()) / 1000 / 60);
        console.log("[WatchClient] Token renovado com sucesso, expira em", expiresInMinutes, "minutos (", Math.round(expiresInMinutes / 60 * 10) / 10, "horas)");
        
        // Atualizar expiração
        setTokenExpiresAt(newData.expiresAt);
        
        // Guardar nova URL para referência (usada se precisar recarregar)
        currentStreamUrlRef.current = newData.streamUrl;
        
        // IMPORTANTE: NÃO recarregar o source automaticamente!
        // O buffer do HLS.js já tem segmentos suficientes para continuar
        // Só recarrega se forceReload=true (chamado quando dá erro 403)
        if (forceReload && hlsRef.current && videoRef.current) {
          const currentPos = videoRef.current.currentTime;
          const wasPlaying = !videoRef.current.paused;
          
          console.log("[WatchClient] Recarregando source com novo token (posição:", currentPos, ")");
          
          // Salvar posição para restaurar
          savedPositionRef.current = currentPos;
          
          // Recarregar source com nova URL
          hlsRef.current.loadSource(newData.streamUrl);
          
          // Atualizar estado
          setData(prev => prev ? { ...prev, playbackUrl: newData.streamUrl } : prev);
          
          // Restaurar playback após manifest ser carregado
          if (wasPlaying) {
            let restored = false;
            const onManifestParsed = () => {
              if (restored) return;
              restored = true;
              if (videoRef.current) {
                videoRef.current.currentTime = savedPositionRef.current;
                videoRef.current.play().catch(() => {});
                savedPositionRef.current = 0;
              }
            };
            hlsRef.current.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
          }
        } else {
          // Renovação silenciosa: apenas log, sem interromper playback
          console.log("[WatchClient] Token renovado silenciosamente (sem reload)");
        }
      }
    } catch (err) {
      console.error("[WatchClient] Erro ao renovar token:", err);
    } finally {
      isRenewingTokenRef.current = false;
    }
  }, [episodeId, titleId]);

  // Renovação automática de token para streaming protegido
  // Token agora dura 3 HORAS no Worker, então renovamos a cada 2.5 horas (bem antes de expirar)
  // Na prática, a maioria dos filmes/episódios termina antes disso
  useEffect(() => {
    if (!isProtectedStream || !data) return;

    // Limpar interval anterior
    if (tokenRenewalTimeoutRef.current) {
      clearInterval(tokenRenewalTimeoutRef.current);
    }

    // Token dura 3 horas no Worker, renovar a cada 2.5 horas (150 minutos)
    // Isso dá 30 minutos de margem antes de expirar
    const RENEWAL_INTERVAL = 150 * 60 * 1000; // 2.5 horas = 150 minutos
    
    console.log("[WatchClient] Token válido por 3 horas. Renovação agendada para 2.5 horas (se necessário)");

    // Agendar renovação periódica (silenciosa, sem reload)
    // Na prática, raramente vai executar pois filmes duram menos que 2.5h
    tokenRenewalTimeoutRef.current = setInterval(() => {
      console.log("[WatchClient] Renovação periódica do token (2.5h)...");
      renewTokenAndUpdatePlayer(false); // false = não forçar reload
    }, RENEWAL_INTERVAL);

    return () => {
      if (tokenRenewalTimeoutRef.current) {
        clearInterval(tokenRenewalTimeoutRef.current);
      }
    };
  }, [isProtectedStream, data, renewTokenAndUpdatePlayer]);

  // Buscar próximo episódio se for série/anime
  useEffect(() => {
    async function fetchNextEpisode() {
      if (!episodeId || !data) return;
      
      try {
        const res = await fetch(`/api/titles/${titleId}/seasons`);
        if (!res.ok) return;
        
        interface EpisodeInfo {
          id: string;
          name: string;
          episodeNumber: number;
        }
        interface SeasonInfo {
          seasonNumber: number;
          episodes?: EpisodeInfo[];
        }
        const seasons: SeasonInfo[] = await res.json();
        
        // Encontrar episódio atual
        let currentSeason: SeasonInfo | null = null;
        let currentEp: EpisodeInfo | null = null;
        
        for (const season of seasons) {
          const ep = season.episodes?.find((e) => e.id === episodeId);
          if (ep) {
            currentSeason = season;
            currentEp = ep;
            break;
          }
        }
        
        if (!currentEp || !currentSeason) return;
        
        // Buscar próximo episódio na mesma temporada
        const nextEpInSeason = currentSeason.episodes?.find(
          (e) => e.episodeNumber === currentEp!.episodeNumber + 1
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
          (s) => s.seasonNumber === currentSeason!.seasonNumber + 1
        );
        
        if (nextSeason && nextSeason.episodes?.length && nextSeason.episodes.length > 0) {
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

    // Restaurar posição salva se houver (após renovação de token)
    const restorePosition = () => {
      if (savedPositionRef.current > 0) {
        console.log("[WatchClient] Restaurando posição:", savedPositionRef.current);
        video.currentTime = savedPositionRef.current;
        savedPositionRef.current = 0;
      }
    };

    console.log("[WatchClient] Tipo de stream:", kind, "| HLS.js suportado:", Hls.isSupported());
    
    if (kind === "mp4") {
      video.src = src;
      video.addEventListener("loadedmetadata", restorePosition, { once: true });
       
      video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      // PRIORIZAR HLS.js para ter controle do buffer
      console.log("%c[HLS] INICIANDO PLAYER HLS", "color: yellow; font-size: 20px; font-weight: bold");
      
      // Função para atualizar informações do buffer
      const updateBufferInfo = () => {
        const dur = video.duration;
        if (!dur || !Number.isFinite(dur) || dur === 0) return;
        
        const buffered = video.buffered;
        if (buffered.length > 0) {
          const bufferedEnd = buffered.end(buffered.length - 1);
          const pct = (bufferedEnd / dur) * 100;
          const ahead = bufferedEnd - video.currentTime;
          
          // Log para debug
          console.log(`[BUFFER] ${pct.toFixed(1)}% | ${ahead.toFixed(0)}s ahead`);
          
          setBufferedPercent(Math.min(100, pct));
          setBufferHealth(ahead < 10 ? "low" : ahead < 30 ? "medium" : "high");
        }
      };
      
      // Monitorar buffer via eventos do vídeo
      console.log("[WatchClient] Adicionando listeners de buffer");
      video.addEventListener("progress", updateBufferInfo);
      video.addEventListener("timeupdate", updateBufferInfo);
      
      // Limpar interval anterior
      if (bufferIntervalRef.current) {
        clearInterval(bufferIntervalRef.current);
      }
      
      // Atualizar buffer a cada 500ms
      bufferIntervalRef.current = setInterval(() => {
        const dur = video.duration;
        if (!dur || !Number.isFinite(dur) || dur === 0) return;
        
        const buffered = video.buffered;
        if (buffered.length > 0) {
          const bufferedEnd = buffered.end(buffered.length - 1);
          const pct = (bufferedEnd / dur) * 100;
          const ahead = bufferedEnd - video.currentTime;
          
          console.log(`%c[BUFFER] ${ahead.toFixed(0)}s à frente | ${pct.toFixed(1)}% total`, 'color: lime; font-weight: bold');
          
          setBufferedPercent(Math.min(100, pct));
          setBufferHealth(ahead < 10 ? "low" : ahead < 30 ? "medium" : "high");
        }
      }, 1000);

      // Detectar dispositivo e velocidade para configurar buffer adaptativo
      const deviceType = getDeviceType();
      
      const initHls = async () => {
        const speedMbps = await measureNetworkSpeed();
        const bufferConfig = getBufferConfig(deviceType, speedMbps);
        
        console.log("[WatchClient] Buffer adaptativo:", {
          dispositivo: deviceType,
          velocidade: `${speedMbps} Mbps`,
          config: bufferConfig,
        });

        const hls = new Hls({
          // === BUFFER CONFIG ===
          // Buffer moderado para evitar problemas de memória
          maxBufferLength: 60,           // 1 minuto de buffer à frente
          maxMaxBufferLength: 120,       // Máximo 2 minutos
          backBufferLength: 30,          // Manter 30s atrás
          maxBufferSize: 60 * 1000 * 1000, // 60MB de buffer
          maxBufferHole: 0.5,
          
          // === ABR (Adaptive Bitrate) - ESTABILIDADE ===
          // Configurações conservadoras para evitar trocas frequentes de qualidade
          abrEwmaDefaultEstimate: 3000000,  // Assumir 3Mbps inicial (conservador)
          abrBandWidthFactor: 0.7,          // Usar 70% da banda medida (margem de segurança)
          abrBandWidthUpFactor: 0.5,        // Só sobe de qualidade se tiver 50% de margem
          abrMaxWithRealBitrate: true,      // Considerar bitrate real do segmento
          
          // Evitar trocas de qualidade quando buffer está baixo
          // Só permite trocar se tiver pelo menos 10s de buffer
          startLevel: -1,                   // Auto-detectar nível inicial
          
          // === RETRY CONFIG ===
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 500,
          fragLoadingMaxRetryTimeout: 8000,
          levelLoadingMaxRetry: 4,
          manifestLoadingMaxRetry: 4,
          
          // === OUTRAS CONFIGS ===
          startPosition: -1,
          lowLatencyMode: false,            // Priorizar estabilidade sobre latência
          progressive: true,
          
          // Capstone: não abortar carregamento de fragmento ao trocar de nível
          // Isso evita o "flash" da capa quando troca de qualidade
          nextLoadLevel: -1,
        });
        hlsRef.current = hls;
        
        console.log("[HLS] Iniciado com ABR conservador (estabilidade > qualidade)");

        // Log de trocas de qualidade para debug
        hls.on(Hls.Events.LEVEL_SWITCHING, (_event, data) => {
          const levelData = data as HlsLevelData;
          console.log(`%c[HLS] Trocando para nível ${levelData.level}`, 'color: orange; font-weight: bold');
        });


        // Log de buffering (menos verbose)
        let lastBufferLog = 0;
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          const now = Date.now();
          if (now - lastBufferLog < 5000) return; // Log a cada 5s no máximo
          lastBufferLog = now;
          
          const buffered = videoRef.current?.buffered;
          if (buffered && buffered.length > 0) {
            const ahead = buffered.end(buffered.length - 1) - (videoRef.current?.currentTime || 0);
            console.log(`[HLS] Buffer: ${ahead.toFixed(0)}s à frente`);
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          const parsedData = data as HlsManifestData;
          const levelsArray = Array.isArray(parsedData?.levels) ? parsedData.levels : [];
          const mapped: QualityLevelInfo[] = levelsArray.map((level: { height?: number; bitrate?: number }, index: number) => ({
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
          
          // Restaurar posição após manifest parsed
          restorePosition();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const switchedData = data as HlsLevelData;
          if (typeof switchedData?.level === "number") {
            console.log(`%c[HLS] Qualidade alterada para nível ${switchedData.level}`, 'color: green; font-weight: bold');
            setCurrentLevelIndex(switchedData.level);
          }
        });

        // Handler de erro para detectar 403 (token expirado) e renovar
        hls.on(Hls.Events.ERROR, (_event, data) => {
          const errorData = data as HlsErrorData;
          console.log("[WatchClient] HLS Error:", errorData.type, errorData.details, errorData.response?.code);
          
          // Verificar se é erro 403 (token expirado)
          if (errorData.response?.code === 403 || 
              (errorData.type === Hls.ErrorTypes.NETWORK_ERROR && 
               errorData.details === Hls.ErrorDetails.FRAG_LOAD_ERROR &&
               errorData.response?.code === 403)) {
            console.log("[WatchClient] Token expirado detectado (403), renovando COM reload...");
            
            // Salvar posição atual antes de renovar
            if (video.currentTime > 0) {
              savedPositionRef.current = video.currentTime;
            }
            
            // Renovar token E forçar reload (true) porque o token atual expirou
            renewTokenAndUpdatePlayer(true);
            return;
          }
          
          // Para outros erros fatais, mostrar erro
          if (errorData.fatal) {
            switch (errorData.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("[WatchClient] Erro de rede fatal, tentando recuperar...");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error("[WatchClient] Erro de mídia fatal, tentando recuperar...");
                hls.recoverMediaError();
                break;
              default:
                console.error("[WatchClient] Erro fatal não recuperável:", errorData);
                setError("Erro ao reproduzir o vídeo. Tente recarregar a página.");
                break;
            }
          }
        });

        hls.loadSource(src);
        hls.attachMedia(video);
      };

      // Inicializar HLS de forma assíncrona
      initHls();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Fallback para HLS nativo (Safari/iOS)
      console.log("[WatchClient] Usando HLS nativo");
      video.src = src;
      video.addEventListener("loadedmetadata", restorePosition, { once: true });
      video.play().catch(() => {});
    } else {
      setError("Seu navegador não suporta HLS.");
    }

    return () => {
      // Limpar interval de buffer
      if (bufferIntervalRef.current) {
        clearInterval(bufferIntervalRef.current);
        bufferIntervalRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      // Limpar estados de buffer
      setBufferedPercent(0);
      setBufferHealth("medium");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Tela de bloqueio por falta de assinatura
  if (subscriptionBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black to-gray-900 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m5-6a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Assinatura Necessária</h1>
            <p className="text-gray-400 mb-6">
              Para assistir este conteúdo, você precisa ter uma assinatura ativa do FlixCRD.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-medium">Plano Básico</span>
              <span className="text-2xl font-bold text-white">R$ 10<span className="text-sm text-gray-400">/mês</span></span>
            </div>
            <ul className="text-left text-sm text-gray-300 space-y-2 mb-4">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Acesso a todos os filmes e séries
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Qualidade HD
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Sem anúncios
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/subscribe')}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              Assinar Agora
            </button>
            <button
              onClick={() => router.back()}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
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
               
              track.mode = defaultIndex !== null && index === defaultIndex ? "showing" : "hidden";
            });
            setSubtitleTracks(tracks);
            setCurrentSubtitleIndex(defaultIndex);

            // Buscar progresso salvo para Continuar assistindo
            // Primeiro verifica localStorage (mais recente), depois servidor
            // IMPORTANTE: Só fazer isso UMA VEZ para evitar loops
            if (profileId && !hasRestoredProgressRef.current) {
              hasRestoredProgressRef.current = true; // Marcar como já restaurado
               
              (async () => {
                try {
                  let resume = 0;
                  let total = loadedDuration;

                  // 1. Verificar localStorage primeiro (progresso local mais recente)
                  const progressKey = `progress_${episodeId || titleId}_${profileId}`;
                  const localProgress = localStorage.getItem(progressKey);
                  if (localProgress) {
                    try {
                      const parsed = JSON.parse(localProgress);
                      // Usar local se for recente (menos de 1 hora)
                      if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
                        resume = Number(parsed.positionSeconds ?? 0);
                        total = Number(parsed.durationSeconds ?? loadedDuration);
                      }
                    } catch {
                      // JSON inválido, ignorar
                    }
                  }

                  // 2. Se não tiver local recente, buscar do servidor
                  if (resume === 0) {
                    const baseUrl = episodeId
                      ? `/api/titles/${titleId}/progress?episodeId=${encodeURIComponent(episodeId)}`
                      : `/api/titles/${titleId}/progress`;

                    const sep = baseUrl.includes("?") ? "&" : "?";
                    const progressUrl = `${baseUrl}${sep}profileId=${encodeURIComponent(profileId)}`;

                    const res = await fetch(progressUrl);
                    if (res.ok) {
                      const json = await res.json();
                      resume = Number(json?.positionSeconds ?? 0);
                      total = Number(json?.durationSeconds ?? loadedDuration ?? 0);
                    }
                  }

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

            // Salvar progresso localmente com alta frequência (para precisão)
            const progressKey = `progress_${episodeId || titleId}_${profileId}`;
            localStorage.setItem(progressKey, JSON.stringify({
              positionSeconds: newTime,
              durationSeconds: total,
              timestamp: Date.now(),
            }));

            // Sincronizar com servidor apenas a cada 30 segundos (economiza requests)
            const now = Date.now();
            if (
              profileId &&
              total &&
              Number.isFinite(total) &&
              now - lastProgressSyncRef.current > 60000
            ) {
              lastProgressSyncRef.current = now;

              queueProgressSync(newTime, total);
            }
          }}
          onSeeked={(event) => {
            const videoEl = event.currentTarget;
            const total = videoEl.duration || duration;
            const pos = videoEl.currentTime;
            if (!total || !Number.isFinite(total)) return;
            if (!profileId) return;

            queueProgressSync(pos, total);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={(event) => {
            setIsPlaying(false);
            const videoEl = event.currentTarget;
            const total = videoEl.duration || duration;
            const pos = videoEl.currentTime;
            if (!total || !Number.isFinite(total)) return;
            if (!profileId) return;

            queueProgressSync(pos, total);
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={(event) => {
            setIsPlaying(false);
            const videoEl = event.currentTarget;
            const total = videoEl.duration || duration;
            if (!total || !Number.isFinite(total)) return;
            if (!profileId) return;

            queueProgressSync(total, total);
            
            // Mostrar countdown para próximo episódio
            if (nextEpisode) {
              setShowNextEpisodeCountdown(true);
              setCountdown(10);
            }
          }}
        >
          {data.subtitles?.map((sub, index) => (
            <track
               
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
          {/* Barra de progresso com buffer */}
          <div
            className="mb-2 h-1.5 w-full cursor-pointer rounded-full bg-zinc-700/80 relative overflow-hidden"
            onClick={handleSeekBarClick}
          >
            {/* Buffer carregado (cinza claro) */}
            <div
              className="absolute h-full rounded-full bg-zinc-500/60 transition-all duration-300"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Progresso atual (vermelho) */}
            <div
              className="absolute h-full rounded-full bg-red-600"
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

            {/* Indicador de saúde do buffer */}
            {bufferedPercent > 0 && (
              <div 
                className="flex items-center gap-1 text-[10px] text-zinc-400"
                title={`Buffer: ${Math.round(bufferedPercent)}% carregado`}
              >
                <div 
                  className={`w-2 h-2 rounded-full ${
                    bufferHealth === "high" 
                      ? "bg-green-500" 
                      : bufferHealth === "medium" 
                        ? "bg-yellow-500" 
                        : "bg-red-500"
                  }`}
                />
                <span className="hidden md:inline">
                  {bufferHealth === "high" ? "Buffer OK" : bufferHealth === "medium" ? "Carregando..." : "Buffer baixo"}
                </span>
              </div>
            )}

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
                     
                    hls.autoLevelEnabled = true;
                    setAutoQuality(true);
                    return;
                  }
                  const levelIndex = Number(value);
                  if (Number.isNaN(levelIndex)) return;
                  hls.currentLevel = levelIndex;
                   
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
