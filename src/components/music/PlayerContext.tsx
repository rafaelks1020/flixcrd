"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PlayerTrack } from "./player-types";

type RepeatMode = "off" | "all" | "one";

type PlaySession = {
  trackId: string;
  source: string;
  recorded: boolean;
};

type PlayerState = {
  current: PlayerTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: PlayerTrack[];
  queueIndex: number;
  isShuffling: boolean;
  repeatMode: RepeatMode;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  play: (t: PlayerTrack) => Promise<void>;
  playQueue: (tracks: PlayerTrack[], startIndex?: number) => Promise<void>;
  toggle: () => Promise<void>;
  pause: () => void;
  seek: (timeSeconds: number) => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  clearError: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
};

const Ctx = createContext<PlayerState | null>(null);

const VOLUME_KEY = "pflix_music_volume";
const MUTED_KEY = "pflix_music_muted";

function readVolume() {
  if (typeof window === "undefined") return 0.8;
  const stored = localStorage.getItem(VOLUME_KEY);
  if (!stored) return 0.8;
  const value = parseFloat(stored);
  if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
  return 0.8;
}

function readMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTED_KEY) === "true";
}

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isShuffling, setIsShuffling] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");

  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatModeRef = useRef(repeatMode);
  const isShufflingRef = useRef(isShuffling);
  const playSessionRef = useRef<PlaySession | null>(null);
  const listenedRef = useRef(0);
  const resumeAbortRef = useRef<AbortController | null>(null);
  const lastTimeUpdateRef = useRef(0);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { isShufflingRef.current = isShuffling; }, [isShuffling]);

  useEffect(() => {
    setVolumeState(readVolume());
    setIsMuted(readMuted());
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const recordCurrent = useCallback((completed: boolean) => {
    const session = playSessionRef.current;
    if (!session || session.recorded) return;
    session.recorded = true;
    const durationSec = Math.max(0, Math.min(604800, Math.floor(listenedRef.current)));
    void fetch("/api/music/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackId: session.trackId,
        durationSec,
        completed,
        source: session.source,
      }),
    }).catch(() => {});
  }, []);

  const openSession = useCallback((track: PlayerTrack) => {
    listenedRef.current = 0;
    playSessionRef.current = {
      trackId: track.id,
      source: (track.source || "manual").slice(0, 100),
      recorded: false,
    };
  }, []);

  const syncPosition = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !("mediaSession" in navigator)) return;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const position = Math.min(Math.max(0, audio.currentTime || 0), audio.duration);
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position,
      });
    } catch {
      // Alguns navegadores recusam o estado se a duração ainda não fechou.
    }
  }, []);

  const startPlayback = useCallback(async (track: PlayerTrack) => {
    const audio = audioRef.current;
    if (!audio) {
      setError("Player não disponível");
      return;
    }
    if (!track.streamUrl) {
      setError("Áudio indisponível");
      return;
    }

    recordCurrent(false);
    resumeAbortRef.current?.abort();
    openSession(track);
    setCurrent(track);
    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);

    try {
      audio.src = track.streamUrl;
      audio.load();
      await audio.play();
      setIsPlaying(true);
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setError("Toque para reproduzir");
        const resume = async () => {
          try {
            await audio.play();
            setIsPlaying(true);
            setError(null);
          } catch {
            setIsPlaying(false);
          }
        };
        const abort = new AbortController();
        resumeAbortRef.current = abort;
        document.addEventListener("pointerdown", () => { void resume(); }, { once: true, signal: abort.signal });
      } else {
        setError("Erro ao reproduzir");
      }
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, [openSession, recordCurrent]);

  const replayCurrent = useCallback(() => {
    const audio = audioRef.current;
    const session = playSessionRef.current;
    if (!audio || !session) return;
    playSessionRef.current = { trackId: session.trackId, source: session.source, recorded: false };
    listenedRef.current = 0;
    audio.currentTime = 0;
    void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, []);

  const nextTrack = useCallback(async () => {
    const list = queueRef.current;
    const index = queueIndexRef.current;
    if (list.length === 0 || index < 0) return;

    let nextIndex: number;
    if (isShufflingRef.current && list.length > 1) {
      nextIndex = index;
      while (nextIndex === index) nextIndex = Math.floor(Math.random() * list.length);
    } else {
      nextIndex = index + 1;
      if (nextIndex >= list.length) {
        if (repeatModeRef.current === "all") {
          nextIndex = 0;
        } else {
          recordCurrent(false);
          audioRef.current?.pause();
          setIsPlaying(false);
          return;
        }
      }
    }

    const track = list[nextIndex];
    if (!track) return;
    setQueueIndex(nextIndex);
    await startPlayback(track);
  }, [recordCurrent, startPlayback]);

  const prevTrack = useCallback(async () => {
    const list = queueRef.current;
    const index = queueIndexRef.current;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      listenedRef.current = 0;
      setCurrentTime(0);
      return;
    }

    let prevIndex = index - 1;
    if (prevIndex < 0) prevIndex = repeatModeRef.current === "all" ? list.length - 1 : 0;
    const track = list[prevIndex];
    if (!track) return;
    setQueueIndex(prevIndex);
    await startPlayback(track);
  }, [startPlayback]);

  const nextRef = useRef(nextTrack);
  const prevRef = useRef(prevTrack);
  useEffect(() => { nextRef.current = nextTrack; }, [nextTrack]);
  useEffect(() => { prevRef.current = prevTrack; }, [prevTrack]);

  const setVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, value));
    setVolumeState(next);
    setIsMuted(false);
    localStorage.setItem(VOLUME_KEY, String(next));
    localStorage.setItem(MUTED_KEY, "false");
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((muted) => {
      const next = !muted;
      localStorage.setItem(MUTED_KEY, String(next));
      return next;
    });
  }, []);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const limit = Number.isFinite(audio.duration) ? audio.duration : time;
    audio.currentTime = Math.max(0, Math.min(limit, time));
    listenedRef.current = Math.max(listenedRef.current, audio.currentTime);
    setCurrentTime(audio.currentTime);
    syncPosition();
  }, [syncPosition]);

  const play = useCallback(async (track: PlayerTrack) => {
    if (!track.streamUrl) {
      setError("Áudio indisponível");
      return;
    }
    setQueue([track]);
    setQueueIndex(0);
    await startPlayback(track);
  }, [startPlayback]);

  const playQueue = useCallback(async (tracks: PlayerTrack[], startIndex = 0) => {
    const list = tracks.filter((track) => track?.streamUrl);
    if (list.length === 0) {
      setError("Nenhuma faixa disponível");
      return;
    }
    const index = Math.max(0, Math.min(list.length - 1, startIndex));
    setQueue(list);
    setQueueIndex(index);
    await startPlayback(list[index]);
  }, [startPlayback]);

  const toggleShuffle = useCallback(() => setIsShuffling((value) => !value), []);
  const cycleRepeat = useCallback(() => {
    setRepeatMode((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
  }, []);
  const clearError = useCallback(() => setError(null), []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.currentTime)) listenedRef.current = Math.max(listenedRef.current, audio.currentTime);
    const now = Date.now();
    if (now - lastTimeUpdateRef.current < 250) return;
    lastTimeUpdateRef.current = now;
    setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    syncPosition();
  }, [syncPosition]);

  const handleEnded = useCallback(() => {
    recordCurrent(true);
    if (repeatModeRef.current === "one") {
      replayCurrent();
      return;
    }
    void nextTrack();
  }, [nextTrack, recordCurrent, replayCurrent]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const safe = (name: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try { navigator.mediaSession.setActionHandler(name, handler); } catch { /* ação não suportada */ }
    };
    safe("play", () => { void audioRef.current?.play(); });
    safe("pause", () => { audioRef.current?.pause(); });
    safe("previoustrack", () => { void prevRef.current(); });
    safe("nexttrack", () => { void nextRef.current(); });
    safe("seekbackward", (details) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10));
    });
    safe("seekforward", (details) => {
      const audio = audioRef.current;
      if (!audio) return;
      const limit = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + 10;
      audio.currentTime = Math.min(limit, audio.currentTime + (details.seekOffset || 10));
    });
    safe("seekto", (details) => {
      const audio = audioRef.current;
      if (!audio || details.seekTime == null) return;
      const limit = Number.isFinite(audio.duration) ? audio.duration : details.seekTime;
      audio.currentTime = Math.max(0, Math.min(limit, details.seekTime));
    });
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!current) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artistName,
        album: current.albumTitle,
        artwork: current.coverUrl ? [{ src: current.coverUrl, sizes: "512x512" }] : [],
      });
    } catch {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artistName,
        album: current.albumTitle,
      });
    }
  }, [current]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [current, isPlaying]);

  const value: PlayerState = {
    current,
    isPlaying,
    isLoading,
    error,
    currentTime,
    duration,
    volume,
    isMuted,
    queue,
    queueIndex,
    isShuffling,
    repeatMode,
    setVolume,
    toggleMute,
    play,
    playQueue,
    toggle,
    pause,
    seek,
    next: nextTrack,
    previous: prevTrack,
    toggleShuffle,
    cycleRepeat,
    clearError,
    audioRef,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => { setIsPlaying(true); setIsLoading(false); }}
        onPause={() => setIsPlaying(false)}
        onCanPlay={() => setIsLoading(false)}
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (audio) setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          setIsLoading(false);
          syncPosition();
        }}
        onTimeUpdate={handleTimeUpdate}
        onError={() => {
          setError("Erro ao carregar áudio");
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onEnded={handleEnded}
      />
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer must be used within MusicPlayerProvider");
  return ctx;
}
