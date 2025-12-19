"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, type SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ChevronLeft,
  Settings2,
  Subtitles,
  SkipForward,
  Keyboard,
  Info,
  AlertCircle,
  Clock,
  Zap,
  Loader2,
  Lock,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Tipos para eventos HLS
interface HlsLevelData { level: number; }
interface HlsManifestData { levels: Array<{ height?: number; bitrate?: number }>; }
interface HlsErrorData {
  type: string;
  details: string;
  fatal?: boolean;
  response?: { code?: number };
}

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
  subtitles?: Array<{ label: string; language?: string | null; url: string; }>;
}

interface QualityLevelInfo { index: number; height?: number; bitrate?: number; }
interface WatchClientProps { titleId: string; episodeId?: string; }

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
  const [isHovering, setIsHovering] = useState(true);
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
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

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
  const isLoadingPlaybackRef = useRef<boolean>(false);
  const isRenewingTokenRef = useRef<boolean>(false);
  const savedPositionRef = useRef<number>(0);
  const currentStreamUrlRef = useRef<string | null>(null);
  const bufferIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRestoredProgressRef = useRef<boolean>(false);
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
      if (pendingProgressRef.current) void flushProgressQueue();
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
      const v = videoRef.current;
      if (!v) return;
      const total = v.duration || duration;
      if (!profileId || !total || !Number.isFinite(total)) return;
      const pos = v.currentTime;
      const payload = JSON.stringify({ positionSeconds: pos, durationSeconds: total, episodeId: episodeId ?? null, profileId });
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          navigator.sendBeacon(`/api/titles/${titleId}/progress`, new Blob([payload], { type: "application/json" }));
          lastSyncedPositionRef.current = Math.max(0, Math.floor(pos));
          return;
        } catch { }
      }
      queueProgressSync(pos, total);
    };
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [duration, episodeId, profileId, queueProgressSync, titleId]);

  const titleMeta = data?.title;
  const mediaTitle = titleMeta?.episodeName || titleMeta?.name || "Pflix";
  const mediaSubtitle = (typeof titleMeta?.seasonNumber === "number" && typeof titleMeta?.episodeNumber === "number")
    ? `S${String(titleMeta.seasonNumber).padStart(2, "0")}E${String(titleMeta.episodeNumber).padStart(2, "0")}`
    : undefined;

  useEffect(() => {
    if (typeof navigator === "undefined" || !titleMeta) return;
    const ms = (navigator as any).mediaSession;
    if (!ms) return;
    try {
      const MediaMetadataCtor = (window as any).MediaMetadata;
      if (typeof MediaMetadataCtor === "function") {
        ms.metadata = new MediaMetadataCtor({
          title: mediaTitle,
          artist: mediaSubtitle || "",
          album: "Pflix",
          artwork: titleMeta.posterUrl ? [{ src: titleMeta.posterUrl, sizes: "512x512", type: "image/png" }] : undefined,
        });
      }
    } catch { }
    const safeSetHandler = (action: string, handler: any) => { try { ms.setActionHandler?.(action, handler); } catch { } };
    safeSetHandler("play", async () => { const v = videoRef.current; if (v) await v.play().catch(() => { }); });
    safeSetHandler("pause", () => { videoRef.current?.pause(); });
    safeSetHandler("seekbackward", (details: any) => {
      const v = videoRef.current; if (!v) return;
      v.currentTime = Math.max(0, (v.currentTime || 0) - Number(details?.seekOffset ?? 10));
    });
    safeSetHandler("seekforward", (details: any) => {
      const v = videoRef.current; if (!v) return;
      v.currentTime = Math.min(v.duration || Infinity, (v.currentTime || 0) + Number(details?.seekOffset ?? 10));
    });
    safeSetHandler("seekto", (details: any) => {
      const v = videoRef.current; if (!v || !Number.isFinite(details?.seekTime)) return;
      v.currentTime = Number(details.seekTime);
    });
  }, [mediaSubtitle, mediaTitle, titleMeta]);

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof document === "undefined") return;
    const release = async () => { try { await wakeLockRef.current?.release?.(); } catch { } finally { wakeLockRef.current = null; } };
    const request = async () => {
      if (!isPlaying || document.visibilityState !== "visible" || !(navigator as any).wakeLock?.request || wakeLockRef.current) return;
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        wakeLockRef.current?.addEventListener?.("release", () => { wakeLockRef.current = null; });
      } catch { }
    };
    const onVisibility = () => { if (document.visibilityState === "visible") void request(); else void release(); };
    document.addEventListener("visibilitychange", onVisibility);
    void request();
    return () => { document.removeEventListener("visibilitychange", onVisibility); void release(); };
  }, [isPlaying]);

  const getDeviceType = useCallback((): "xbox" | "mobile" | "tv" | "desktop" => {
    if (typeof navigator === "undefined") return "desktop";
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("xbox")) return "xbox";
    if (ua.includes("smart-tv") || ua.includes("webos") || ua.includes("tizen")) return "tv";
    if (/android|iphone|ipad/i.test(ua)) return "mobile";
    return "desktop";
  }, []);

  const measureNetworkSpeed = useCallback(async (): Promise<number> => {
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as any).connection;
      if (conn?.downlink) return conn.downlink;
    }
    return 10;
  }, []);

  const getBufferConfig = useCallback((deviceType: string, speedMbps: number) => {
    const configs = {
      xbox: { maxBufferLength: 30, maxMaxBufferLength: 60, backBufferLength: 10 },
      tv: { maxBufferLength: 45, maxMaxBufferLength: 90, backBufferLength: 15 },
      mobile: { maxBufferLength: 60, maxMaxBufferLength: 120, backBufferLength: 20 },
      desktop: { maxBufferLength: 120, maxMaxBufferLength: 300, backBufferLength: 30 },
    };
    const baseConfig = configs[deviceType as keyof typeof configs] || configs.desktop;
    let multiplier = speedMbps < 5 ? 0.5 : speedMbps < 15 ? 0.75 : speedMbps > 50 ? 1.5 : 1;
    if (deviceType === "xbox") multiplier = Math.min(multiplier, 1);
    return {
      maxBufferLength: Math.round(baseConfig.maxBufferLength * multiplier),
      maxMaxBufferLength: Math.round(baseConfig.maxMaxBufferLength * multiplier),
      backBufferLength: baseConfig.backBufferLength,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setProfileId(window.localStorage.getItem("activeProfileId"));
  }, []);

  useEffect(() => {
    async function testarVelocidadeCloudflare(): Promise<number> {
      if (typeof performance === "undefined" || typeof fetch === "undefined") return Infinity;
      const inicio = performance.now();
      try {
        const res = await fetch("/api/status/cloudflare", { cache: "no-store" });
        if (!res.ok) return Infinity;
      } catch { return Infinity; }
      return performance.now() - inicio;
    }
    async function loadPlayback() {
      if (isLoadingPlaybackRef.current) return;
      isLoadingPlaybackRef.current = true;
      setLoading(true);
      setError(null);
      setSubscriptionBlocked(false);
      try {
        const subRes = await fetch('/api/subscription/check');
        const subData = await subRes.json();
        if (!subData.canWatch) { setSubscriptionBlocked(true); setLoading(false); return; }
        let proxyFlag = false;
        if (profileId) {
          try {
            const profileRes = await fetch(`/api/profiles/${encodeURIComponent(profileId)}`, { cache: "no-store" });
            if (profileRes.status === 404) {
              window.localStorage.removeItem("activeProfileId");
              setProfileId(null);
              router.push("/profiles");
              return;
            }
            if (profileRes.ok) {
              const profileJson = await profileRes.json();
              proxyFlag = Boolean(profileJson?.useCloudflareProxy);
            }
          } catch { }
        }
        setUseCloudflareProxy(proxyFlag);
        const source = proxyFlag && (await testarVelocidadeCloudflare()) <= 300 ? "cloudflare" : "direct";
        const baseUrl = episodeId ? `/api/episodes/${episodeId}/playback` : `/api/titles/${titleId}/playback`;
        const res = await fetch(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}source=${source}`);
        const json = await res.json();
        if (!res.ok) { setError(json?.error ?? "Erro ao carregar playback."); setLoading(false); return; }
        setData(json);
        if (json.protected && json.expiresAt) { setIsProtectedStream(true); setTokenExpiresAt(json.expiresAt); }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro crítico.");
      } finally { setLoading(false); }
    }
    loadPlayback();
    return () => { isLoadingPlaybackRef.current = false; hasRestoredProgressRef.current = false; };
  }, [titleId, episodeId, profileId, router]);

  const renewTokenAndUpdatePlayer = useCallback(async (forceReload = false) => {
    if (isRenewingTokenRef.current) return;
    isRenewingTokenRef.current = true;
    try {
      const contentType = episodeId ? "episode" : "title";
      const contentId = episodeId || titleId;
      const res = await fetch("/api/stream/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType, contentId }) });
      if (!res.ok) return;
      const newData = await res.json();
      if (newData.streamUrl && newData.expiresAt) {
        setTokenExpiresAt(newData.expiresAt);
        currentStreamUrlRef.current = newData.streamUrl;
        if (forceReload && hlsRef.current && videoRef.current) {
          const currentPos = videoRef.current.currentTime;
          const wasPlaying = !videoRef.current.paused;
          savedPositionRef.current = currentPos;
          hlsRef.current.loadSource(newData.streamUrl);
          setData(prev => prev ? { ...prev, playbackUrl: newData.streamUrl } : prev);
          if (wasPlaying) {
            let restored = false;
            hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
              if (restored || !videoRef.current) return;
              restored = true;
              videoRef.current.currentTime = savedPositionRef.current;
              videoRef.current.play().catch(() => { });
              savedPositionRef.current = 0;
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally { isRenewingTokenRef.current = false; }
  }, [episodeId, titleId]);

  useEffect(() => {
    if (!isProtectedStream || !data) return;
    if (tokenRenewalTimeoutRef.current) clearInterval(tokenRenewalTimeoutRef.current);
    tokenRenewalTimeoutRef.current = setInterval(() => { renewTokenAndUpdatePlayer(false); }, 150 * 60 * 1000); // 2.5h
    return () => { if (tokenRenewalTimeoutRef.current) clearInterval(tokenRenewalTimeoutRef.current); };
  }, [isProtectedStream, data, renewTokenAndUpdatePlayer]);

  useEffect(() => {
    async function fetchNextEpisode() {
      if (!episodeId || !data) return;
      try {
        const res = await fetch(`/api/titles/${titleId}/seasons`);
        if (!res.ok) return;
        const seasons = await res.json();
        let curSeason: any = null, curEp: any = null;
        for (const s of seasons) {
          const ep = s.episodes?.find((e: any) => e.id === episodeId);
          if (ep) { curSeason = s; curEp = ep; break; }
        }
        if (!curEp || !curSeason) return;
        const nextInSeason = curSeason.episodes?.find((e: any) => e.episodeNumber === curEp!.episodeNumber + 1);
        if (nextInSeason) {
          setNextEpisode({ id: nextInSeason.id, name: nextInSeason.name, episodeNumber: nextInSeason.episodeNumber, seasonNumber: curSeason.seasonNumber });
          return;
        }
        const nextSeason = seasons.find((s: any) => s.seasonNumber === curSeason!.seasonNumber + 1);
        if (nextSeason?.episodes?.length) {
          const first = nextSeason.episodes[0];
          setNextEpisode({ id: first.id, name: first.name, episodeNumber: first.episodeNumber, seasonNumber: nextSeason.seasonNumber });
        }
      } catch { }
    }
    fetchNextEpisode();
  }, [titleId, episodeId, data]);

  useEffect(() => {
    if (!showNextEpisodeCountdown || !nextEpisode) return;
    if (countdown === 0) { router.push(`/watch/${titleId}?episodeId=${nextEpisode.id}`); return; }
    const timer = setTimeout(() => { setCountdown(prev => prev - 1); }, 1000);
    return () => clearTimeout(timer);
  }, [showNextEpisodeCountdown, countdown, nextEpisode, titleId, router]);

  useEffect(() => {
    const vc = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", vc);
    return () => document.removeEventListener("fullscreenchange", vc);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setIsHovering(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    if (isPlaying) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setIsHovering(false);
        setShowQualityMenu(false);
        setShowSubtitleMenu(false);
      }, 3500);
    }
  }, [isPlaying]);

  const handleTrackLoad = (event: SyntheticEvent<HTMLTrackElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = Array.from(video.textTracks || []);
    let defaultIndex: number | null = null;
    if (tracks.length === 1) defaultIndex = 0;
    else {
      const ptIndex = tracks.findIndex(t => (t.language || "").toLowerCase().startsWith("pt") || (t.label || "").toLowerCase().includes("pt"));
      if (ptIndex >= 0) defaultIndex = ptIndex;
    }
    tracks.forEach((t, i) => { t.mode = defaultIndex !== null && i === defaultIndex ? "showing" : "hidden"; });
    setSubtitleTracks(tracks);
    setCurrentSubtitleIndex(defaultIndex);
  };

  useEffect(() => {
    if (!data?.playbackUrl || !videoRef.current) return;
    const video = videoRef.current;
    const { playbackUrl: src, kind = "hls" } = data;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const restorePosition = () => { if (savedPositionRef.current > 0) { video.currentTime = savedPositionRef.current; savedPositionRef.current = 0; } };

    if (kind === "mp4") {
      video.src = src;
      video.addEventListener("loadedmetadata", restorePosition, { once: true });
      video.play().catch(() => { });
    } else if (Hls.isSupported()) {
      const h = new Hls({ maxBufferLength: 60, maxMaxBufferLength: 120, backBufferLength: 30, abrEwmaDefaultEstimate: 5000000, startLevel: -1 });
      hlsRef.current = h;
      h.on(Hls.Events.MANIFEST_PARSED, (_e, d: any) => {
        setQualityLevels(d.levels.map((l: any, i: number) => ({ index: i, height: l.height, bitrate: l.bitrate })));
        setCurrentLevelIndex(h.currentLevel);
        setAutoQuality(h.autoLevelEnabled);
        restorePosition();
      });
      h.on(Hls.Events.LEVEL_SWITCHED, (_e, d: any) => setCurrentLevelIndex(d.level));
      h.on(Hls.Events.ERROR, (_e, d: any) => {
        if (d.response?.code === 403) renewTokenAndUpdatePlayer(true);
        else if (d.fatal) { if (d.type === Hls.ErrorTypes.NETWORK_ERROR) h.startLoad(); else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) h.recoverMediaError(); }
      });
      h.loadSource(src);
      h.attachMedia(video);
      if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
      bufferIntervalRef.current = setInterval(() => {
        if (!video.duration) return;
        const b = video.buffered;
        if (b.length > 0) {
          const ahead = b.end(b.length - 1) - video.currentTime;
          setBufferedPercent((b.end(b.length - 1) / video.duration) * 100);
          setBufferHealth(ahead < 10 ? "low" : ahead < 30 ? "medium" : "high");
        }
      }, 1000);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src; video.addEventListener("loadedmetadata", restorePosition, { once: true }); video.play().catch(() => { });
    }
    return () => { if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current); if (hlsRef.current) hlsRef.current.destroy(); };
  }, [data?.playbackUrl, renewTokenAndUpdatePlayer]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const v = videoRef.current; if (!v || ["INPUT", "TEXTAREA"].includes((e.target as any).tagName)) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") { e.preventDefault(); v.paused ? v.play().catch(() => { }) : v.pause(); }
      else if (k === "arrowleft" || k === "j") { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); }
      else if (k === "arrowright" || k === "l") { e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 10); }
      else if (k === "arrowup") { e.preventDefault(); const n = Math.min(1, volume + 0.1); v.volume = n; setVolume(n); setIsMuted(n === 0); }
      else if (k === "arrowdown") { e.preventDefault(); const n = Math.max(0, volume - 0.1); v.volume = n; setVolume(n); setIsMuted(n === 0); }
      else if (k === "m") { e.preventDefault(); v.muted = !isMuted; setIsMuted(!isMuted); }
      else if (k === "f") { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen?.() : playerRef.current?.requestFullscreen?.(); }
      else if (k === "?" || k === "h") { e.preventDefault(); setShowShortcuts(p => !p); }
      else if (k >= "0" && k <= "9") { e.preventDefault(); v.currentTime = (Number(e.key) * 10 / 100) * v.duration; }
      showControlsTemporarily();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [volume, isMuted, showControlsTemporarily]);

  if (loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black gap-6">
      <div className="relative">
        <div className="w-24 h-24 border-4 border-primary/20 rounded-full animate-spin border-t-primary" />
        <Zap className="absolute inset-0 m-auto text-primary animate-pulse" size={32} />
      </div>
      <p className="text-zinc-500 font-black uppercase tracking-[0.4em] text-[10px] animate-pulse">Iniciando Cinema Experience v4</p>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6">
      <div className="glass-card bg-zinc-900/60 p-12 rounded-[40px] border border-white/10 text-center space-y-6 max-w-md">
        <AlertCircle className="mx-auto text-primary" size={64} />
        <h2 className="text-2xl font-black tracking-tight">Ops! Algo deu errado</h2>
        <p className="text-zinc-500 font-medium">{error}</p>
        <button onClick={() => window.location.reload()} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-zinc-200 transition-all">Tentar Novamente</button>
      </div>
    </div>
  );

  if (subscriptionBlocked) return (
    <div className="flex min-h-screen items-center justify-center bg-black relative p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-black to-black opacity-50" />
      <div className="relative glass-card bg-zinc-900/40 p-10 md:p-16 rounded-[48px] border border-white/5 text-center max-w-2xl space-y-10 shadow-2xl">
        <Lock className="mx-auto text-primary" size={80} strokeWidth={1} />
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Área Restrita</h1>
          <p className="text-zinc-500 text-lg font-medium leading-relaxed">Para acessar nosso catálogo premium, você precisa de uma assinatura ativa.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <button onClick={() => router.push('/subscribe')} className="flex-1 py-5 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-[24px] shadow-xl shadow-primary/20 hover:scale-105 transition-all">Assinar Agora</button>
          <button onClick={() => router.back()} className="flex-1 py-5 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-[24px] hover:bg-white/10 transition-all">Voltar</button>
        </div>
      </div>
    </div>
  );

  if (!data) return null;
  const { title } = data;
  const yearStr = title.releaseDate?.slice(0, 4);
  const displayName = title.episodeName || title.name;
  const episodeLabel = (typeof title.seasonNumber === "number" && typeof title.episodeNumber === "number")
    ? `S${String(title.seasonNumber).padStart(2, "0")}E${String(title.episodeNumber).padStart(2, "0")}` : null;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black text-white select-none overflow-hidden font-sans">
      <div ref={playerRef} className="group relative w-full h-full flex items-center justify-center cursor-none group-hover:cursor-auto"
        onMouseMove={() => { showControlsTemporarily(); playerRef.current!.style.cursor = 'default'; }}
        onMouseLeave={() => { setIsHovering(false); playerRef.current!.style.cursor = 'none'; }}>

        {/* Ambient Mood Layer */}
        {title.backdropUrl && <div className="absolute inset-0 pointer-events-none transition-opacity duration-1000"><img src={title.backdropUrl} className="w-full h-full object-cover opacity-10 blur-2xl scale-125" /></div>}

        <video ref={videoRef} className="z-0 w-full h-full bg-black object-contain" poster={title.posterUrl || undefined} muted={isMuted} crossOrigin="anonymous"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration); setVolume(e.currentTarget.volume); handleTrackLoad(e as any);
            if (profileId && !hasRestoredProgressRef.current) {
              hasRestoredProgressRef.current = true;
              (async () => {
                try {
                  const res = await fetch(`/api/titles/${titleId}/progress?${episodeId ? `episodeId=${episodeId}&` : ''}profileId=${profileId}`);
                  if (res.ok) { const j = await res.json(); if (j.positionSeconds > 0) { e.currentTarget.currentTime = j.positionSeconds; setCurrentTime(j.positionSeconds); } }
                } catch { }
              })();
            }
          }}
          onTimeUpdate={(e) => { setCurrentTime(e.currentTarget.currentTime); queueProgressSync(e.currentTarget.currentTime, e.currentTarget.duration); }}
          onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onWaiting={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)}
          onEnded={() => { setIsPlaying(false); queueProgressSync(duration, duration); if (nextEpisode) { setShowNextEpisodeCountdown(true); setCountdown(10); } }}
        >
          {data.subtitles?.map((s, i) => <track key={i} kind="subtitles" src={s.url} srcLang={s.language || undefined} label={s.label} default={i === 0} onLoad={handleTrackLoad} />)}
        </video>

        {/* HUD: Top Bar */}
        <AnimatePresence>
          {(isHovering || !isPlaying) && !showNextEpisodeCountdown && (
            <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
              className="absolute inset-x-0 top-0 z-50 p-6 md:p-10 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-6">
                <button onClick={() => router.back()} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-primary hover:scale-110 transition-all flex items-center justify-center backdrop-blur-xl border border-white/5">
                  <ChevronLeft size={24} />
                </button>
                <div className="space-y-0.5">
                  <h1 className="text-xl md:text-2xl font-black tracking-tight drop-shadow-lg">{displayName}</h1>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {yearStr && <span>{yearStr}</span>}
                    {yearStr && <span>•</span>}
                    {episodeLabel && <span className="text-primary">{episodeLabel}</span>}
                    {episodeLabel && <span>•</span>}
                    <span className="flex items-center gap-1"><Zap size={10} className="text-yellow-400" /> ULTRA HD</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Perfil Ativo</span>
                  <span className="text-xs font-bold text-white uppercase tracking-tighter">Master Access</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xl">👤</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD: Buffering */}
        <AnimatePresence>
          {isBuffering && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="absolute z-20 flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary drop-shadow-lg">Buffering Experience</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD: Central Play Action */}
        <AnimatePresence>
          {(isHovering || !isPlaying) && !showNextEpisodeCountdown && !isBuffering && (
            <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => setIsPlaying(!videoRef.current?.paused)}
              className="absolute z-40 w-24 h-24 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-white shadow-2xl group/play">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover/play:shadow-primary/40">
                {videoRef.current?.paused ? <Play size={40} fill="currentColor" className="ml-2" /> : <Pause size={40} fill="currentColor" />}
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* HUD: Next Episode Countdown */}
        <AnimatePresence>
          {showNextEpisodeCountdown && nextEpisode && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-2xl flex items-center justify-center">
              <div className="max-w-xl w-full text-center space-y-12 p-10">
                <div className="space-y-4">
                  <p className="text-primary font-black uppercase tracking-[0.4em] text-xs">Próxima Parada</p>
                  <h2 className="text-5xl md:text-6xl font-black tracking-tight line-clamp-2">{nextEpisode.name}</h2>
                  <p className="text-zinc-500 font-bold tracking-widest uppercase">S{nextEpisode.seasonNumber.toString().padStart(2, '0')} · E{nextEpisode.episodeNumber.toString().padStart(2, '0')}</p>
                </div>
                <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle cx="64" cy="64" r="60" className="stroke-zinc-800 fill-none" strokeWidth="8" />
                    <motion.circle cx="64" cy="64" r="60" className="stroke-primary fill-none" strokeWidth="8"
                      initial={{ pathLength: 1 }} animate={{ pathLength: 0 }} transition={{ duration: 10, ease: "linear" }} />
                  </svg>
                  <span className="text-4xl font-black">{countdown}</span>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => router.push(`/watch/${titleId}?episodeId=${nextEpisode.id}`)}
                    className="flex-1 py-5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all">
                    Assistir Agora <SkipForward size={18} />
                  </button>
                  <button onClick={() => { setShowNextEpisodeCountdown(false); setCountdown(10); videoRef.current?.play(); }}
                    className="flex-1 py-5 bg-zinc-900 border border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-zinc-800 transition-all">
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD: Bottom Controls */}
        <AnimatePresence>
          {(isHovering || !isPlaying) && !showNextEpisodeCountdown && (
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="absolute inset-x-0 bottom-0 z-50 p-6 md:p-10 space-y-6 pt-20 bg-gradient-to-t from-black via-black/80 to-transparent">

              {/* Futuristic Progress Slider */}
              <div className="relative group/seeker">
                <div className="absolute -top-10 left-0 w-full flex justify-between px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <span className="text-white bg-black/40 px-2 py-0.5 rounded-md border border-white/5 backdrop-blur-md">{formatTime(currentTime)}</span>
                  <span className="opacity-0 group-hover/seeker:opacity-100 transition-opacity">Saltar para Aqui</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="relative h-1.5 w-full bg-white/5 rounded-full cursor-pointer overflow-hidden backdrop-blur-sm border border-white/5"
                  onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const nt = ((e.clientX - r.left) / r.width) * duration; videoRef.current!.currentTime = nt; }}>
                  <div className="absolute h-full bg-zinc-700/40 rounded-full transition-all duration-300" style={{ width: `${bufferedPercent}%` }} />
                  <motion.div className="h-full bg-primary relative" style={{ width: `${progressPercent}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(229,9,20,0.8)] scale-0 group-hover/seeker:scale-100 transition-transform" />
                  </motion.div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 md:gap-8">
                  <div className="flex items-center gap-4">
                    <button onClick={() => videoRef.current!.currentTime -= 10} className="p-2 text-zinc-400 hover:text-white transition-colors"><RotateCcw size={24} /></button>
                    <button onClick={() => videoRef.current!.paused ? videoRef.current!.play() : videoRef.current!.pause()} className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-all shadow-xl">
                      {videoRef.current?.paused ? <Play size={24} fill="currentColor" className="ml-1" /> : <Pause size={24} fill="currentColor" />}
                    </button>
                    <button onClick={() => videoRef.current!.currentTime += 10} className="p-2 text-zinc-400 hover:text-white transition-colors"><RotateCw size={24} /></button>
                  </div>

                  <div className="flex items-center gap-4 group/volume">
                    <button onClick={() => { videoRef.current!.muted = !isMuted; setIsMuted(!isMuted); }} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                      {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                    </button>
                    <div className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-500 ease-out flex items-center">
                      <input type="range" min={0} max={100} value={volume * 100} onChange={(e) => { const v = +e.target.value / 100; videoRef.current!.volume = v; setVolume(v); setIsMuted(v === 0); }}
                        className="w-20 accent-primary bg-zinc-800 rounded-lg cursor-pointer h-1" />
                    </div>
                  </div>

                  <div className="hidden lg:flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest border-l border-white/10 pl-8">
                    <div className={cn("w-2 h-2 rounded-full", bufferHealth === "high" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : bufferHealth === "medium" ? "bg-yellow-500" : "bg-red-500 animate-pulse")} />
                    {bufferHealth === "high" ? "Stable Connection" : bufferHealth === "medium" ? "Optimizing..." : "Weak Signal"}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="relative">
                    <button onClick={() => { setShowSubtitleMenu(!showSubtitleMenu); setShowQualityMenu(false); }} className={cn("flex items-center gap-2 p-2 rounded-xl transition-all", showSubtitleMenu ? "bg-primary text-white" : "text-zinc-400 hover:text-white")}>
                      <Subtitles size={24} />
                    </button>
                    {showSubtitleMenu && subtitleTracks.length > 0 && (
                      <div className="absolute bottom-16 right-0 w-56 glass-card bg-zinc-900/90 p-4 rounded-3xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 px-2">Legendas</p>
                        <div className="space-y-1">
                          <button onClick={() => { subtitleTracks.forEach(t => t.mode = "hidden"); setCurrentSubtitleIndex(null); }} className={cn("w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-between", currentSubtitleIndex === null ? "bg-primary text-white" : "hover:bg-white/5")}>Desativadas {currentSubtitleIndex === null && <Check size={14} />}</button>
                          {subtitleTracks.map((t, i) => (
                            <button key={i} onClick={() => { subtitleTracks.forEach((tr, id) => tr.mode = id === i ? "showing" : "hidden"); setCurrentSubtitleIndex(i); }} className={cn("w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-between", currentSubtitleIndex === i ? "bg-primary text-white" : "hover:bg-white/5")}>{t.label || t.language || `Track ${i + 1}`} {currentSubtitleIndex === i && <Check size={14} />}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSubtitleMenu(false); }} className={cn("flex items-center gap-2 p-2 rounded-xl transition-all", showQualityMenu ? "bg-primary text-white" : "text-zinc-400 hover:text-white")}>
                      <Settings2 size={24} />
                    </button>
                    {showQualityMenu && qualityLevels.length > 0 && (
                      <div className="absolute bottom-16 right-0 w-56 glass-card bg-zinc-900/90 p-4 rounded-3xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 px-2">Definição</p>
                        <div className="space-y-1">
                          <button onClick={() => { hlsRef.current!.currentLevel = -1; setAutoQuality(true); }} className={cn("w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-between", autoQuality ? "bg-primary text-white" : "hover:bg-white/5")}>Auto Discovery {autoQuality && <Check size={14} />}</button>
                          {qualityLevels.map((l) => (
                            <button key={l.index} onClick={() => { hlsRef.current!.currentLevel = l.index; setAutoQuality(false); setCurrentLevelIndex(l.index); }} className={cn("w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-between", !autoQuality && currentLevelIndex === l.index ? "bg-primary text-white" : "hover:bg-white/5")}>{l.height}p Ultra {!autoQuality && currentLevelIndex === l.index && <Check size={14} />}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setShowShortcuts(!showShortcuts)} className="text-zinc-400 hover:text-white transition-colors p-2"><Keyboard size={24} /></button>
                  <button onClick={() => document.fullscreenElement ? document.exitFullscreen?.() : playerRef.current?.requestFullscreen?.()} className="text-zinc-400 hover:text-white transition-colors p-2">{isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD: Keyboard Shortcuts Help */}
        <AnimatePresence>
          {showShortcuts && (
            <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}
              className="absolute right-10 top-1/2 -translate-y-1/2 z-50 glass-card bg-zinc-900/80 backdrop-blur-3xl border border-white/10 rounded-[40px] p-10 w-80 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black italic tracking-tighter">Command Unit</h3>
                <button onClick={() => setShowShortcuts(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="space-y-6">
                {[{ k: "SPACE / K", d: "Neural Play/Pause" }, { k: "J / L", d: "Temporal Jump ±10s" }, { k: "UP / DOWN", d: "Amplitude Volume" }, { k: "M", d: "Silent Protocol" }, { k: "F", d: "Total Immersion" }].map((s, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{s.k}</span>
                    <span className="text-sm font-medium text-white">{s.d}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10 pt-6 border-t border-white/5">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Pflix Control Interface v4.2.0</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function X({ size, className }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
