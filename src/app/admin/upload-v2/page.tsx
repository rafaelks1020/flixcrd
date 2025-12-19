"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ============================================================================
// TYPES
// ============================================================================

type TitleType = "MOVIE" | "SERIES" | "ANIME" | "OTHER";

interface TmdbResult {
  tmdbId: number;
  type: TitleType;
  name: string;
  originalName: string | null;
  overview: string;
  releaseDate: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
}

interface UploadFile {
  id: string;
  file: File;
  seasonNumber?: number;
  episodeNumber?: number;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error" | "cancelled";
  error?: string;
  uploadSpeed?: number; // bytes per second
  uploadedBytes?: number;
  startTime?: number;
  estimatedTimeLeft?: number; // seconds
  retryCount?: number;
}

interface CreatedTitle {
  id: string;
  name: string;
  slug: string;
  type: TitleType;
}

type EpisodeHlsStatus = "none" | "uploaded" | "hls_ready" | "error";

interface EpisodeSummaryForUpload {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  hlsStatus: EpisodeHlsStatus;
}

// Usar multipart para qualquer tamanho de arquivo. Mantido como constante para facilitar ajuste futuro.
const MULTIPART_THRESHOLD_BYTES = 0;
const MULTIPART_PART_SIZE_BYTES = 64 * 1024 * 1024;
const MULTIPART_CONCURRENCY = 6;
const MULTIPART_MAX_RETRIES = 3;

interface UploadedPartInfo {
  partNumber: number;
  eTag: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ============================================================================
// EPISODE DETECTION - METICULOUS PARSER
// ============================================================================

// Dicionário de números romanos
const ROMANS: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20,
};

// Padrões de ruído para remover antes de analisar
const NOISE_PATTERNS = [
  /\[.*?\]/g,                           // [HorribleSubs] [1080p]
  /\(.*?\)/g,                           // (2024) (Dual Audio)
  /(1080|720|480|2160)[pk]?/gi,         // Resoluções
  /(x264|x265|h264|h265|hevc|av1)/gi,   // Codecs de vídeo
  /(aac|flac|ac3|dts|opus)/gi,          // Codecs de áudio
  /(web-?dl|bluray|hdtv|dvdrip|bdrip|webrip)/gi, // Fonte
  /(repack|proper|final)/gi,            // Versões
  /\b(10bit|hi10p|hdr|sdr)\b/gi,        // Tech specs
  /\b(dual[._-]?audio|multi[._-]?sub)\b/gi, // Audio/Sub info
  /\b(legendado|dublado|ptbr|pt-br)\b/gi,   // Idioma
];

interface ParseResult {
  season: number | null;
  episode: number | null;
  type: string;
  absolute: boolean;
  confidence: number;
}

function cleanFilename(filename: string): string {
  let clean = filename;
  for (const pattern of NOISE_PATTERNS) {
    clean = clean.replace(pattern, " ");
  }
  // Remover extensão
  clean = clean.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v)$/i, "");
  // Normalizar espaços
  clean = clean.replace(/[._]/g, " ").replace(/\s+/g, " ").trim();
  return clean;
}

function checkRomanSeason(filename: string): number | null {
  // Procura palavras isoladas que sejam números romanos
  const words = filename.split(/[\s.\-_]+/);
  for (const word of words) {
    const upper = word.toUpperCase();
    if (ROMANS[upper] !== undefined) {
      return ROMANS[upper];
    }
  }
  return null;
}

function detectEpisodeMeticulous(filename: string): ParseResult {
  const originalFilename = filename;
  const cleanName = cleanFilename(filename);
  
  const result: ParseResult = {
    season: null,
    episode: null,
    type: "Unknown",
    absolute: false,
    confidence: 0,
  };

  // --- CAMADA 1: PADRÕES EXPLÍCITOS (SxxExx / 1x01) ---
  const explicitPatterns = [
    { regex: /[sS](\d+)\s*[eE](\d+)/, groups: 2 },           // S01E01, S01 E01
    { regex: /[sS](\d+)[._-][eE](\d+)/, groups: 2 },         // S01.E01, S01_E01
    { regex: /(\d+)[xX](\d+)/, groups: 2 },                  // 1x01
    { regex: /[sS]eason\s*(\d+)\s*[eE]pisode\s*(\d+)/i, groups: 2 }, // Season 1 Episode 1
    { regex: /[eE][pP]?\.?\s?(\d+)/, groups: 1 },            // Ep.01, EP01, E01
    { regex: /[eE]pisode\s*(\d+)/i, groups: 1 },             // Episode 01
    { regex: /[cC]ap(?:itulo)?\.?\s*(\d+)/, groups: 1 },     // Capitulo 01
    { regex: /第(\d+)[話集]/, groups: 1 },                    // Japonês (第01話)
    { regex: /(\d+)[話集]/, groups: 1 },                      // 01話
  ];

  for (const { regex, groups } of explicitPatterns) {
    const match = cleanName.match(regex);
    if (match) {
      if (groups === 2) {
        result.season = parseInt(match[1], 10);
        result.episode = parseInt(match[2], 10);
        result.type = "Standard";
        result.confidence = 95;
        return result;
      } else if (groups === 1) {
        result.episode = parseInt(match[1], 10);
        result.season = checkRomanSeason(cleanName);
        if (result.season === null) {
          result.season = 1;
          result.type = "Absolute/Anime";
          result.absolute = true;
        } else {
          result.type = "Roman Season";
        }
        result.confidence = 85;
        return result;
      }
    }
  }

  // --- CAMADA 2: NUMERAÇÃO ABSOLUTA (Anime " - 01") ---
  // Padrão: Separador + Número + Fim (ou versão v2)
  const absoluteMatches = cleanName.match(/(?:[\s\-_])(\d{1,4})(?:v\d)?(?:[\s.]|$)/g);
  if (absoluteMatches) {
    // Pega todos os números e filtra anos (1950-2030)
    const candidates = absoluteMatches
      .map(m => parseInt(m.replace(/[^\d]/g, ""), 10))
      .filter(n => !(n > 1950 && n < 2030));
    
    if (candidates.length > 0) {
      // Pega o último número que não é ano
      result.episode = candidates[candidates.length - 1];
      result.absolute = true;
      result.type = "Absolute/Implicit";
      result.season = checkRomanSeason(cleanName) || 1;
      result.confidence = 70;
      return result;
    }
  }

  // --- CAMADA 3: PADRÃO COM VERSÃO (01v3, 12v2) - MAIS ESPECÍFICO ---
  // Regex: _01v3_ ou -12v2- (captura só o número antes do v)
  const versionMatch = originalFilename.match(/[_\-\s](\d{1,3})v\d+[_\-\s]/i);
  if (versionMatch) {
    const num = parseInt(versionMatch[1], 10);
    if (num >= 1 && num <= 999) {
      result.episode = num;
      result.season = checkRomanSeason(originalFilename) || 1;
      result.type = "Fansub Version";
      result.confidence = 85;
      return result;
    }
  }

  // --- CAMADA 3.5: PADRÃO FANSUB GENÉRICO (Nome_-_01_HD) ---
  const fansubMatch = originalFilename.match(/[_\-]\s*(\d{1,3})[_\-](?:HD|SD)?/i);
  if (fansubMatch) {
    const num = parseInt(fansubMatch[1], 10);
    if (num >= 1 && num <= 999) {
      result.episode = num;
      result.season = checkRomanSeason(originalFilename) || 1;
      result.type = "Fansub Style";
      result.confidence = 75;
      return result;
    }
  }

  // --- CAMADA 4: CASOS EXTREMOS / ERROS OCR ---
  // 0l (Zero + L), O1 (Letra O + 1)
  if (/\b0[lL]\b/.test(originalFilename)) {
    result.episode = 1;
    result.season = 1;
    result.type = "OCR Error Fix";
    result.confidence = 50;
    return result;
  }

  // --- CAMADA 5: ÚLTIMO RECURSO - Qualquer número de 2 dígitos ---
  const lastResort = cleanName.match(/\b(\d{2})\b/);
  if (lastResort) {
    const num = parseInt(lastResort[1], 10);
    if (num >= 1 && num <= 99 && !(num > 19 && num < 30)) { // Evita anos como 20, 21, 22...
      result.episode = num;
      result.season = checkRomanSeason(cleanName) || 1;
      result.type = "Last Resort";
      result.confidence = 40;
      return result;
    }
  }

  return result;
}

// Fallback com IA para casos impossíveis
// Chama rota server-side que usa GROQ_API_KEY
async function detectEpisodeWithAI(filename: string): Promise<ParseResult | null> {
  try {
    const res = await fetch("/api/admin/detect-episode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });

    if (!res.ok) {
      console.error("[IA] Erro na API:", res.status);
      return null;
    }

    const data = await res.json();

    if (data.episode !== null && data.episode !== undefined) {
      return {
        season: data.season ?? 1,
        episode: data.episode,
        type: "IA (Groq)",
        absolute: false,
        confidence: data.confidence ?? 85,
      };
    }

    return null;
  } catch (err) {
    console.error("[IA] Erro ao detectar episódio:", err);
    return null;
  }
}

// Função principal de detecção
async function detectEpisode(filename: string): Promise<{ season?: number; episode?: number } | null> {
  // Primeiro tenta o parser meticuloso
  const result = detectEpisodeMeticulous(filename);
  
  if (result.episode !== null && result.confidence >= 40) {
    console.log(`[Parser] ${filename} → S${result.season}E${result.episode} (${result.type}, ${result.confidence}%)`);
    return {
      season: result.season || 1,
      episode: result.episode,
    };
  }

  // Se não encontrou com confiança, tenta IA
  console.log(`[Parser] ${filename} → Não detectado, tentando IA...`);
  const aiResult = await detectEpisodeWithAI(filename);
  
  if (aiResult && aiResult.episode !== null) {
    console.log(`[Parser] ${filename} → S${aiResult.season}E${aiResult.episode} (${aiResult.type})`);
    return {
      season: aiResult.season || 1,
      episode: aiResult.episode,
    };
  }

  console.log(`[Parser] ${filename} → Não foi possível detectar`);
  return null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UploadV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // TMDB Search
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbResult | null>(null);

  // Created Title
  const [createdTitle, setCreatedTitle] = useState<CreatedTitle | null>(null);
  const [creatingTitle, setCreatingTitle] = useState(false);

  // Files
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Episodes / status
  const [episodes, setEpisodes] = useState<EpisodeSummaryForUpload[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Options
  const [autoTranscode, setAutoTranscode] = useState(true);
  const [deleteSource, setDeleteSource] = useState(true);
  const [crf, setCrf] = useState(20);
  const [notifyOnComplete, setNotifyOnComplete] = useState(false);
  const [queueUploads, setQueueUploads] = useState(true);

  // Status
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aiDetectingId, setAiDetectingId] = useState<string | null>(null);
  const [previousSessionSummary, setPreviousSessionSummary] = useState<
    | {
        titleName: string | null;
        total: number;
        pending: number;
        completed: number;
        savedAt?: string;
      }
    | null
  >(null);
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);
  const uploadXhrs = useRef<Record<string, XMLHttpRequest | null>>({});
  const uploadAbortControllers = useRef<Record<string, AbortController | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  function canUseNotifications() {
    return typeof window !== "undefined" && "Notification" in window;
  }

  async function ensureNotificationPermission(): Promise<boolean> {
    if (!canUseNotifications()) return false;

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "denied") {
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }

  function showNotification(title: string, options?: NotificationOptions) {
    if (!canUseNotifications()) return;
    if (Notification.permission !== "granted") return;

    try {
      // eslint-disable-next-line no-new
      new Notification(title, options);
    } catch {
      // Ignore notification errors
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "true");
      folderInputRef.current.setAttribute("directory", "true");
    }
  }, []);

  function appendUploadLog(entry: {
    fileName: string;
    fileSize: number;
    status: "completed" | "error" | "cancelled";
    errorMessage?: string | null;
    seasonNumber?: number;
    episodeNumber?: number;
  }) {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("flixcrd:upload-logs");
      const existing = raw ? (JSON.parse(raw) as any[]) : [];
      const now = new Date().toISOString();

      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: now,
        titleId: createdTitle?.id ?? null,
        titleName: createdTitle?.name ?? null,
        ...entry,
      };

      const next = [record, ...existing].slice(0, 200);
      window.localStorage.setItem("flixcrd:upload-logs", JSON.stringify(next));
    } catch {
      // ignore log persistence errors
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("flixcrd:upload-v2:session");
      if (!raw) return;

      const data = JSON.parse(raw) as {
        createdTitle?: CreatedTitle | null;
        uploadFiles?: Array<{
          name: string;
          size: number;
          seasonNumber?: number;
          episodeNumber?: number;
          status?: UploadFile["status"];
        }>;
        savedAt?: string;
      };

      const files = Array.isArray(data.uploadFiles) ? data.uploadFiles : [];
      if (files.length === 0) {
        window.localStorage.removeItem("flixcrd:upload-v2:session");
        return;
      }

      const total = files.length;
      const completed = files.filter((f) => f.status === "completed").length;
      const pending = total - completed;

      if (pending <= 0) {
        window.localStorage.removeItem("flixcrd:upload-v2:session");
        return;
      }

      setPreviousSessionSummary({
        titleName: data.createdTitle?.name ?? null,
        total,
        completed,
        pending,
        savedAt: data.savedAt,
      });

      window.localStorage.removeItem("flixcrd:upload-v2:session");
    } catch {
      window.localStorage.removeItem("flixcrd:upload-v2:session");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const persistedFiles = uploadFiles.map((f) => ({
        name: f.file.name,
        size: f.file.size,
        seasonNumber: f.seasonNumber,
        episodeNumber: f.episodeNumber,
        status: f.status,
      }));

      const payload = {
        createdTitle,
        uploadFiles: persistedFiles,
        autoTranscode,
        deleteSource,
        crf,
        notifyOnComplete,
        queueUploads,
        savedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(
        "flixcrd:upload-v2:session",
        JSON.stringify(payload),
      );
    } catch {
      // ignore persistence errors
    }
  }, [
    uploadFiles,
    createdTitle,
    autoTranscode,
    deleteSource,
    crf,
    notifyOnComplete,
    queueUploads,
  ]);

  useEffect(() => {
    const fromUrl = searchParams.get("requestId");
    if (fromUrl && !linkedRequestId) {
      setLinkedRequestId(fromUrl);
    }
  }, [searchParams, linkedRequestId]);

  // Carregar título diretamente quando vier de uma solicitação atendida
  useEffect(() => {
    const titleIdFromUrl = searchParams.get("titleId");
    if (!titleIdFromUrl || createdTitle) return;

    (async () => {
      try {
        setError(null);
        const res = await fetch(`/api/titles/${titleIdFromUrl}`);
        if (!res.ok) return;

        const data = await res.json();
        if (!data?.id) return;

        setCreatedTitle({
          id: data.id,
          name: data.name,
          slug: data.slug,
          type: (data.type || "MOVIE") as TitleType,
        });
        setInfo(`✅ Título "${data.name}" carregado a partir da solicitação.`);
      } catch (err) {
        console.error("Erro ao carregar título inicial para upload-v2:", err);
      }
    })();
  }, [searchParams, createdTitle]);

  // Carregar episódios + status HLS/upload para o título atual
  useEffect(() => {
    async function loadEpisodesStatusForTitle(titleId: string) {
      try {
        setLoadingEpisodes(true);
        const res = await fetch(`/api/admin/titles/${titleId}/seasons`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Erro ao carregar temporadas/episódios.");
        }

        const seasonsData = (json.seasons ?? []) as Array<{
          seasonNumber: number;
          name: string | null;
          episodes: Array<{
            id: string;
            seasonNumber: number;
            episodeNumber: number;
            name: string;
          }>;
        }>;

        const flatEpisodes = seasonsData.flatMap((s) =>
          s.episodes.map((ep) => ({
            id: ep.id,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
            name: ep.name,
          })),
        );

        if (flatEpisodes.length === 0) {
          setEpisodes([]);
          return;
        }

        const uniqueIds = Array.from(new Set(flatEpisodes.map((ep) => ep.id)));

        const entries = await Promise.all(
          uniqueIds.map(async (id) => {
            try {
              const r = await fetch(`/api/admin/episodes/${id}/hls-status`);
              if (!r.ok) {
                return [id, "error" as EpisodeHlsStatus] as const;
              }
              const j = await r.json();
              const status = (j?.status as EpisodeHlsStatus) ?? "none";
              return [id, status] as const;
            } catch {
              return [id, "error" as EpisodeHlsStatus] as const;
            }
          }),
        );

        const statusMap: Record<string, EpisodeHlsStatus> = {};
        for (const [id, status] of entries) {
          statusMap[id] = status;
        }

        const withStatus: EpisodeSummaryForUpload[] = flatEpisodes
          .map((ep) => ({
            ...ep,
            hlsStatus: statusMap[ep.id] ?? "none",
          }))
          .sort((a, b) => {
            if (a.seasonNumber !== b.seasonNumber) {
              return a.seasonNumber - b.seasonNumber;
            }
            return a.episodeNumber - b.episodeNumber;
          });

        setEpisodes(withStatus);
      } catch (e) {
        console.error("Erro ao carregar status de episódios para upload-v2:", e);
        setEpisodes([]);
      } finally {
        setLoadingEpisodes(false);
      }
    }

    if (createdTitle?.id) {
      loadEpisodesStatusForTitle(createdTitle.id);
    } else {
      setEpisodes([]);
    }
  }, [createdTitle?.id]);

  // ============================================================================
  // TMDB SEARCH
  // ============================================================================

  async function handleTmdbSearch(e: FormEvent) {
    e.preventDefault();
    if (!tmdbQuery.trim()) return;

    setTmdbLoading(true);
    setError(null);
    try {
      const url = new URL("/api/tmdb/search", window.location.origin);
      url.searchParams.set("q", tmdbQuery.trim());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao consultar TMDb");
      }
      setTmdbResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar TMDb");
    } finally {
      setTmdbLoading(false);
    }
  }

  function selectTmdbResult(result: TmdbResult) {
    setSelectedTmdb(result);
    setTmdbResults([]);
    setTmdbQuery("");
  }

  // ============================================================================
  // CREATE TITLE
  // ============================================================================

  async function createTitle() {
    if (!selectedTmdb) return;

    setCreatingTitle(true);
    setError(null);
    try {
      // Primeiro, verifica se já existe
      const checkRes = await fetch("/api/titles?limit=1000");
      const allTitlesResponse = await checkRes.json();
      const allTitles = allTitlesResponse.data || allTitlesResponse || [];
      
      const existing = Array.isArray(allTitles) 
        ? allTitles.find((t: any) => t.tmdbId === selectedTmdb.tmdbId)
        : null;

      if (existing) {
        // Título já existe!
        setCreatedTitle({
          id: existing.id,
          name: existing.name,
          slug: existing.slug,
          type: existing.type,
        });
        setInfo(
          `ℹ️ Título "${existing.name}" já existe no catálogo! Você pode fazer upload de mais arquivos para ele.`
        );
        
        // Se for série/anime, criar episódios automaticamente se detectados
        if ((existing.type === "SERIES" || existing.type === "ANIME") && uploadFiles.length > 0) {
          await createEpisodesFromFiles(existing.id);
        }
        
        setCreatingTitle(false);
        return;
      }

      // Se não existe, cria novo
      const res = await fetch("/api/titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: selectedTmdb.tmdbId,
          type: selectedTmdb.type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao criar título");
      }

      setCreatedTitle({
        id: data.id,
        name: data.name,
        slug: data.slug,
        type: data.type,
      });
      setInfo(`✅ Título "${data.name}" criado com sucesso!`);
      
      // Se for série/anime, criar episódios automaticamente se detectados
      if ((data.type === "SERIES" || data.type === "ANIME") && uploadFiles.length > 0) {
        await createEpisodesFromFiles(data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar título");
    } finally {
      setCreatingTitle(false);
    }
  }

  async function createEpisodesFromFiles(titleId: string) {
    // Agrupar por temporada
    const episodesBySeason = new Map<number, Array<{ episodeNumber: number; name: string }>>();
    
    uploadFiles.forEach((file) => {
      if (file.seasonNumber && file.episodeNumber) {
        const season = file.seasonNumber;
        if (!episodesBySeason.has(season)) {
          episodesBySeason.set(season, []);
        }
        episodesBySeason.get(season)!.push({
          episodeNumber: file.episodeNumber,
          name: `Episódio ${file.episodeNumber}`,
        });
      }
    });

    // Criar episódios para cada temporada
    for (const [seasonNumber, episodes] of episodesBySeason.entries()) {
      try {
        await fetch("/api/admin/episodes/create-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titleId,
            seasonNumber,
            episodes,
          }),
        });
      } catch (err) {
        console.error(`Erro ao criar episódios da temporada ${seasonNumber}:`, err);
      }
    }
  }

  // ============================================================================
  // FILE HANDLING
  // ============================================================================

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addFiles(files);
  }, []);

  async function addFiles(files: File[]) {
    const allowedExtensions = ["mkv", "mp4", "avi", "mov", "webm", "m4v"];

    const validFiles: File[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      const nameLower = file.name.toLowerCase();
      const match = nameLower.match(/\.([a-z0-9]+)$/);
      const ext = match?.[1] ?? "";
      const isValidExt = allowedExtensions.includes(ext);
      const isNonEmpty = file.size > 0;

      if (isValidExt && isNonEmpty) {
        validFiles.push(file);
      } else {
        rejected.push(file.name);
      }
    }

    if (rejected.length > 0) {
      setError(
        `Alguns arquivos foram ignorados por formato ou tamanho inválido: ${rejected.join(", ")}`,
      );
    }

    if (validFiles.length === 0) {
      return;
    }

    // Primeiro adiciona os arquivos com status "detecting"
    const initialFiles: UploadFile[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      seasonNumber: undefined,
      episodeNumber: undefined,
      progress: 0,
      status: "pending" as const,
    }));

    setUploadFiles((prev) => [...prev, ...initialFiles]);

    // Depois detecta os episódios em paralelo (com IA se necessário)
    for (const uploadFile of initialFiles) {
      const detected = await detectEpisode(uploadFile.file.name);
      if (detected) {
        setUploadFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, seasonNumber: detected.season, episodeNumber: detected.episode }
              : f
          )
        );
      }
    }
  }

  function removeFile(id: string) {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleCancelUpload(id: string) {
    const xhr = uploadXhrs.current[id];
    if (xhr) {
      try {
        xhr.abort();
      } catch {}
    }

    const controller = uploadAbortControllers.current[id];
    if (controller) {
      try {
        controller.abort();
      } catch {}
    }

    setUploadFiles((prev) =>
      prev.map((f) =>
        f.id === id && f.status === "uploading"
          ? { ...f, status: "cancelled", error: "Upload cancelado pelo usuário." }
          : f,
      ),
    );
  }

  // Corrigir episódio manualmente
  function updateEpisode(id: string, season: number, episode: number) {
    setUploadFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, seasonNumber: season, episodeNumber: episode } : f
      )
    );
  }

  // Corrigir com IA
  async function fixWithAI(uploadFile: UploadFile) {
    setAiDetectingId(uploadFile.id);
    setError(null);
    setInfo(`🤖 Detectando episódio com IA para "${uploadFile.file.name}"...`);

    const result = await detectEpisodeWithAI(uploadFile.file.name);

    if (result && result.episode !== null && result.episode !== undefined) {
      const season = result.season || 1;
      const episode = result.episode as number;

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, seasonNumber: season, episodeNumber: episode }
            : f
        )
      );

      setInfo(
        `✅ IA detectou S${season.toString().padStart(2, "0")}E${episode
          .toString()
          .padStart(2, "0")} para "${uploadFile.file.name}"`
      );
    } else {
      setError("IA não conseguiu identificar temporada/episódio para esse arquivo.");
    }

    setAiDetectingId(null);
  }

  // ============================================================================
  // UPLOAD
  // ============================================================================

  async function startUpload() {
    if (!createdTitle) {
      setError("Crie um título antes de fazer upload!");
      return;
    }

    if (uploadFiles.length === 0) {
      setError("Adicione pelo menos um arquivo!");
      return;
    }

    setError(null);
    setInfo("🚀 Iniciando uploads...");

    if (queueUploads) {
      for (const uploadFile of uploadFiles) {
        // Upload em fila (sequencial)
        await uploadSingleFile(uploadFile);
      }
    } else {
      // Upload paralelo por arquivo (mantendo retry/controle por parte)
      await Promise.all(uploadFiles.map((uploadFile) => uploadSingleFile(uploadFile)));
    }

    setInfo("✅ Todos os uploads concluídos!");

    if (notifyOnComplete) {
      showNotification("Uploads concluídos", {
        body: `${uploadFiles.length} arquivo(s) enviados para "${createdTitle.name}"`,
      });
    }

    if (autoTranscode) {
      setInfo("🎬 Iniciando transcodificação automática...");
      await startTranscoding();
    }

    if (linkedRequestId) {
      try {
        await fetch(`/api/admin/solicitacoes/${linkedRequestId}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titleId: createdTitle.id,
            completedAt: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error(
          "Erro ao atualizar upload da solicitação após conclusão dos uploads:",
          err,
        );
      }
    }
  }

  async function uploadSingleFile(uploadFile: UploadFile) {
    try {
      const startTime = Date.now();
      setUploadFiles((prev) =>
        prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "uploading", startTime } : f))
      );

      let episodeId: string | undefined;

      // Se for série/anime e tiver episódio detectado, criar o episódio primeiro
      if (
        (createdTitle!.type === "SERIES" || createdTitle!.type === "ANIME") &&
        uploadFile.seasonNumber &&
        uploadFile.episodeNumber
      ) {
        try {
          const epRes = await fetch("/api/episodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              titleId: createdTitle!.id,
              seasonNumber: uploadFile.seasonNumber,
              episodeNumber: uploadFile.episodeNumber,
              name: `Episódio ${uploadFile.episodeNumber}`,
            }),
          });

          if (epRes.ok) {
            const epData = await epRes.json();
            episodeId = epData.id;
            console.log(`Episódio criado: S${uploadFile.seasonNumber}E${uploadFile.episodeNumber} -> ${episodeId}`);
          } else {
            // Episódio pode já existir, tentar buscar
            const existingRes = await fetch(
              `/api/episodes?titleId=${createdTitle!.id}&season=${uploadFile.seasonNumber}&episode=${uploadFile.episodeNumber}`
            );
            if (existingRes.ok) {
              const existingData = await existingRes.json();
              if (existingData.id) {
                episodeId = existingData.id;
                console.log(`Episódio existente: S${uploadFile.seasonNumber}E${uploadFile.episodeNumber} -> ${episodeId}`);
              }
            }
          }
        } catch (err) {
          console.error("Erro ao criar/buscar episódio:", err);
        }
      }

      // Arquivos gigantes: usar upload multipart concorrente
      if (uploadFile.file.size >= MULTIPART_THRESHOLD_BYTES) {
        const result = await uploadMultipartFile(uploadFile, createdTitle!.id, episodeId, startTime);
        if (result === "cancelled") {
          return;
        }
        setUploadFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "completed", progress: 100 } : f
          )
        );
        appendUploadLog({
          fileName: uploadFile.file.name,
          fileSize: uploadFile.file.size,
          seasonNumber: uploadFile.seasonNumber,
          episodeNumber: uploadFile.episodeNumber,
          status: "completed",
        });
        return;
      }

      // Fluxo antigo: upload simples com PUT único
      const res = await fetch("/api/wasabi/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId: createdTitle!.id,
          episodeId,
          filename: uploadFile.file.name,
          contentType: uploadFile.file.type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao gerar URL de upload");
      }

      const { uploadUrl } = data;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", uploadFile.file.type || "application/octet-stream");
        uploadXhrs.current[uploadFile.id] = xhr;

        let lastLoaded = 0;
        let lastTime = Date.now();

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;

          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          const bytesDiff = event.loaded - lastLoaded;
          const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
          const remainingBytes = event.total - event.loaded;
          const estimatedTimeLeft = speed > 0 ? remainingBytes / speed : 0;
          const percent = Math.round((event.loaded / event.total) * 100);

          setUploadFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    progress: percent,
                    uploadSpeed: speed,
                    uploadedBytes: event.loaded,
                    estimatedTimeLeft,
                  }
                : f
            )
          );

          lastLoaded = event.loaded;
          lastTime = now;
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id ? { ...f, status: "completed", progress: 100 } : f
              )
            );
            appendUploadLog({
              fileName: uploadFile.file.name,
              fileSize: uploadFile.file.size,
              seasonNumber: uploadFile.seasonNumber,
              episodeNumber: uploadFile.episodeNumber,
              status: "completed",
            });
            resolve();
          } else {
            reject(new Error(`Upload falhou: ${xhr.status}`));
          }
        };

        xhr.onabort = () => {
          setUploadFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? { ...f, status: "cancelled", error: "Upload cancelado pelo usuário." }
                : f,
            ),
          );
          appendUploadLog({
            fileName: uploadFile.file.name,
            fileSize: uploadFile.file.size,
            seasonNumber: uploadFile.seasonNumber,
            episodeNumber: uploadFile.episodeNumber,
            status: "cancelled",
          });
          resolve();
        };

        xhr.onerror = () => reject(new Error("Erro de rede"));
        xhr.send(uploadFile.file);
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro no upload";
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "error", error: errorMsg }
            : f
        )
      );
      appendUploadLog({
        fileName: uploadFile.file.name,
        fileSize: uploadFile.file.size,
        seasonNumber: uploadFile.seasonNumber,
        episodeNumber: uploadFile.episodeNumber,
        status: "error",
        errorMessage: errorMsg,
      });
    } finally {
      uploadXhrs.current[uploadFile.id] = null;
      uploadAbortControllers.current[uploadFile.id] = null;
    }
  }

  async function uploadMultipartFile(
    uploadFile: UploadFile,
    titleId: string,
    episodeId: string | undefined,
    startTime: number,
  ) {
    const controller = new AbortController();
    uploadAbortControllers.current[uploadFile.id] = controller;

    const startRes = await fetch("/api/wasabi/multipart/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleId,
        episodeId,
        filename: uploadFile.file.name,
        contentType: uploadFile.file.type,
      }),
      signal: controller.signal,
    });

    const startJson = await startRes.json();
    if (!startRes.ok) {
      throw new Error(startJson?.error ?? "Erro ao iniciar upload multipart");
    }

    const { uploadId, key } = startJson as { uploadId: string; key: string };

    const file = uploadFile.file;
    const totalSize = file.size;
    const partCount = Math.ceil(totalSize / MULTIPART_PART_SIZE_BYTES);

    const parts = Array.from({ length: partCount }, (_, index) => {
      const partNumber = index + 1;
      const start = index * MULTIPART_PART_SIZE_BYTES;
      const end = Math.min(totalSize, start + MULTIPART_PART_SIZE_BYTES);
      return { partNumber, start, end };
    });

    let uploadedBytes = 0;
    const completedParts: UploadedPartInfo[] = [];
    let currentIndex = 0;
    let caughtError: Error | null = null;

    const worker = async () => {
      while (true) {
        const index = currentIndex;
        if (index >= parts.length || caughtError) {
          break;
        }
        currentIndex += 1;
        const part = parts[index];

        try {
          const blob = file.slice(part.start, part.end);

          let attempt = 0;
          let success = false;
          let eTag = "";

          while (attempt < MULTIPART_MAX_RETRIES && !success) {
            attempt += 1;

            if (attempt > 1) {
              setUploadFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadFile.id
                    ? {
                        ...f,
                        retryCount:
                          typeof f.retryCount === "number"
                            ? Math.max(f.retryCount, attempt)
                            : attempt,
                      }
                    : f,
                ),
              );
            }

            const partRes = await fetch("/api/wasabi/multipart/part-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key, uploadId, partNumber: part.partNumber }),
              signal: controller.signal,
            });

            const partJson = await partRes.json();
            if (!partRes.ok) {
              if (attempt >= MULTIPART_MAX_RETRIES) {
                throw new Error(
                  partJson?.error ?? `Erro ao gerar URL da parte ${part.partNumber}`,
                );
              }
              continue;
            }

            const { uploadUrl } = partJson as { uploadUrl: string };

            const putRes = await fetch(uploadUrl, {
              method: "PUT",
              body: blob,
              signal: controller.signal,
            });

            if (!putRes.ok) {
              if (attempt >= MULTIPART_MAX_RETRIES) {
                throw new Error(
                  `Erro ao enviar parte ${part.partNumber}: ${putRes.status}`,
                );
              }
              continue;
            }

            eTag = putRes.headers.get("ETag") || putRes.headers.get("etag") || "";
            success = true;
          }

          completedParts.push({ partNumber: part.partNumber, eTag });

          uploadedBytes += blob.size;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? uploadedBytes / elapsed : 0;
          const remaining = totalSize - uploadedBytes;
          const estimatedTimeLeft = speed > 0 ? remaining / speed : 0;
          const percent = Math.round((uploadedBytes / totalSize) * 100);

          setUploadFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    progress: percent,
                    uploadSpeed: speed,
                    uploadedBytes,
                    estimatedTimeLeft,
                  }
                : f,
            ),
          );
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          caughtError = error as Error;
          return;
        }
      }
    };

    const workerCount = Math.min(MULTIPART_CONCURRENCY, parts.length);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < workerCount; i += 1) {
      workers.push(worker());
    }

    await Promise.all(workers);

    if (controller.signal.aborted) {
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "cancelled", error: "Upload cancelado pelo usuário." }
            : f,
        ),
      );
      appendUploadLog({
        fileName: uploadFile.file.name,
        fileSize: uploadFile.file.size,
        seasonNumber: uploadFile.seasonNumber,
        episodeNumber: uploadFile.episodeNumber,
        status: "cancelled",
      });
      return "cancelled" as const;
    }

    if (caughtError) {
      throw caughtError;
    }

    const completeRes = await fetch("/api/wasabi/multipart/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        uploadId,
        parts: completedParts.sort((a, b) => a.partNumber - b.partNumber),
      }),
      signal: controller.signal,
    });

    const completeJson = await completeRes.json();
    if (!completeRes.ok) {
      throw new Error(completeJson?.error ?? "Erro ao finalizar upload multipart");
    }

    return "success" as const;
  }

  async function startTranscoding() {
    if (!createdTitle) return;

    try {
      // Para séries/animes, usar API de transcodificação de episódios
      if (createdTitle.type === "SERIES" || createdTitle.type === "ANIME") {
        const res = await fetch(`/api/admin/titles/${createdTitle.id}/transcode-episodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crf,
            deleteSource,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Erro ao iniciar transcodificação");
        }

        const jobCount = data.jobs?.length || 0;
        setInfo(`✅ Transcodificação iniciada para ${jobCount} episódio(s)!`);
        if (notifyOnComplete) {
          showNotification("Transcodificação iniciada", {
            body: `${jobCount} episódio(s) enfileirado(s) para HLS em "${createdTitle.name}"`,
          });
        }
      } else {
        // Para filmes, usar API padrão (mas primeiro precisa definir hlsPath)
        // Primeiro atualiza o hlsPath do título
        const updateRes = await fetch(`/api/titles/${createdTitle.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hlsPath: `titles/${createdTitle.slug}/`,
          }),
        });

        if (!updateRes.ok) {
          throw new Error("Erro ao configurar caminho HLS");
        }

        const res = await fetch(`/api/transcode/hls/${createdTitle.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crf,
            deleteSource,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Erro ao iniciar transcodificação");
        }

        setInfo(`✅ Transcodificação iniciada! Job ID: ${data.jobId}`);
        if (notifyOnComplete) {
          showNotification("Transcodificação iniciada", {
            body: `Job HLS iniciado para "${createdTitle.name}"`,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar transcodificação");
    }
  }

  const isSeriesLike = createdTitle && (createdTitle.type === "SERIES" || createdTitle.type === "ANIME");

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-0">
      <div>
        <h2 className="text-2xl font-semibold">🚀 Upload Unificado</h2>
        <p className="text-zinc-400 text-sm">
          Busque no TMDB, arraste arquivos e pronto! Tudo automatizado.
        </p>
      </div>

      {/* Error/Info Messages */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/60 p-4 text-red-300 text-sm">
          ❌ {error}
        </div>
      )}
      {info && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/60 p-4 text-emerald-300 text-sm">
          {info}
        </div>
      )}
      {previousSessionSummary && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200">
          <p className="font-semibold">
            Sessão anterior: {previousSessionSummary.pending} de {previousSessionSummary.total} upload(s)
            pendente(s)
            {previousSessionSummary.titleName ? ` para "${previousSessionSummary.titleName}"` : ""}.
          </p>
          {previousSessionSummary.savedAt && (
            <p className="mt-1 text-[11px] text-amber-300/80">
              Último registro: {new Date(previousSessionSummary.savedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {linkedRequestId && (
        <div className="rounded-lg border border-sky-800 bg-sky-950/40 p-3 text-xs sm:text-sm text-sky-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="font-semibold">
              Fazendo upload para solicitação #{linkedRequestId}
            </span>
          </div>
          <a
            href={`/solicitacao/${linkedRequestId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-sky-500/60 px-2 py-1 text-[11px] sm:text-xs text-sky-100 hover:bg-sky-900/60"
          >
            Ver solicitação →
          </a>
        </div>
      )}

      {/* Step 1: TMDB Search */}
      {!selectedTmdb && !createdTitle && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">1️⃣ Buscar no TMDB</h3>
            <p className="text-zinc-400 text-sm">Digite o nome do filme ou série</p>
          </div>

          <form onSubmit={handleTmdbSearch} className="flex gap-2">
            <input
              type="text"
              value={tmdbQuery}
              onChange={(e) => setTmdbQuery(e.target.value)}
              placeholder="Ex: Breaking Bad, Inception..."
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
            <button
              type="submit"
              disabled={tmdbLoading}
              className="rounded-md bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {tmdbLoading ? "Buscando..." : "🔍 Buscar"}
            </button>
          </form>

          {/* Results */}
          {tmdbResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-400">{tmdbResults.length} resultados encontrados:</p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tmdbResults.map((result) => (
                  <button
                    key={result.tmdbId}
                    onClick={() => selectTmdbResult(result)}
                    className="w-full flex items-start gap-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-left hover:border-emerald-600 hover:bg-zinc-800"
                  >
                    {result.posterUrl && (
                      <img
                        src={result.posterUrl}
                        alt={result.name}
                        className="w-16 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-zinc-100">{result.name}</p>
                      {result.originalName && result.originalName !== result.name && (
                        <p className="text-sm text-zinc-400">{result.originalName}</p>
                      )}
                      <p className="text-xs text-zinc-500 mt-1">
                        {result.type} • {result.releaseDate?.substring(0, 4) || "N/A"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Selected Title */}
      {selectedTmdb && !createdTitle && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">2️⃣ Título Selecionado</h3>
            <p className="text-zinc-400 text-sm">Confirme e crie o título no catálogo</p>
          </div>

          <div className="flex items-start gap-4">
            {selectedTmdb.posterUrl && (
              <img
                src={selectedTmdb.posterUrl}
                alt={selectedTmdb.name}
                className="w-24 h-36 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <p className="text-xl font-semibold text-zinc-100">{selectedTmdb.name}</p>
              {selectedTmdb.originalName && (
                <p className="text-sm text-zinc-400">{selectedTmdb.originalName}</p>
              )}
              <p className="text-sm text-zinc-500 mt-2">
                {selectedTmdb.type} • {selectedTmdb.releaseDate?.substring(0, 4) || "N/A"}
              </p>
              <p className="text-sm text-zinc-400 mt-2 line-clamp-3">{selectedTmdb.overview}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={createTitle}
              disabled={creatingTitle}
              className="rounded-md bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {creatingTitle ? "Criando..." : "✅ Criar Título"}
            </button>
            <button
              onClick={() => setSelectedTmdb(null)}
              className="rounded-md border border-zinc-700 px-6 py-2 font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              ← Voltar
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Upload Files */}
      {createdTitle && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">3️⃣ Adicionar Arquivos</h3>
            <p className="text-zinc-400 text-sm">
              Arraste arquivos ou clique para selecionar
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-zinc-400">Título:</span>
              <span className="font-semibold text-emerald-400">{createdTitle.name}</span>
              <a
                href="/admin/catalog"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Ver no catálogo →
              </a>
            </div>
          </div>
          {isSeriesLike && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-zinc-200">Status atual dos episódios</span>
                {loadingEpisodes && (
                  <span className="text-[11px] text-zinc-400">Carregando...</span>
                )}
              </div>
              {!loadingEpisodes && episodes.length === 0 && (
                <p className="text-[11px] text-zinc-500">
                  Nenhum episódio importado ainda. Importe temporadas em /admin/catalog.
                </p>
              )}
              {!loadingEpisodes && episodes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {episodes.slice(0, 24).map((ep) => {
                    let badgeClass = "border-zinc-700 text-zinc-300";
                    let label = "Sem upload";
                    if (ep.hlsStatus === "hls_ready") {
                      badgeClass = "border-emerald-700 text-emerald-300 bg-emerald-900/40";
                      label = "HLS pronto";
                    } else if (ep.hlsStatus === "uploaded") {
                      badgeClass = "border-blue-700 text-blue-300 bg-blue-900/40";
                      label = "Upload feito";
                    } else if (ep.hlsStatus === "error") {
                      badgeClass = "border-red-700 text-red-300 bg-red-900/40";
                      label = "Erro";
                    }
                    return (
                      <span
                        key={ep.id}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 ${badgeClass}`}
                      >
                        <span>
                          S{ep.seasonNumber.toString().padStart(2, "0")}E
                          {ep.episodeNumber.toString().padStart(2, "0")}
                        </span>
                        <span className="text-[10px]">{label}</span>
                      </span>
                    );
                  })}
                  {episodes.length > 24 && (
                    <span className="text-[11px] text-zinc-500">
                      +{episodes.length - 24} episódio(s)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-2 border-dashed rounded-lg p-8 sm:p-10 lg:p-12 text-center transition-colors ${
              isDragging
                ? "border-emerald-600 bg-emerald-950/20"
                : "border-zinc-700 bg-zinc-900/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileInput}
              className="hidden"
              id="file-input"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              onChange={handleFileInput}
              className="hidden"
              id="camera-input"
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileInput}
              className="hidden"
              id="folder-input"
            />
            <div className="space-y-3">
              <div>
                <div className="text-3xl sm:text-4xl mb-3">📁</div>
                <p className="text-base sm:text-lg font-semibold text-zinc-100 mb-1">
                  Arraste arquivos aqui ou use os botões abaixo
                </p>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Aceita: .mkv, .mp4, .avi, .mov, .webm
                </p>
              </div>
              <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                <label
                  htmlFor="file-input"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-100 hover:bg-zinc-800"
                >
                  📂 Selecionar da galeria
                </label>
                <label
                  htmlFor="folder-input"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-100 hover:bg-zinc-800"
                >
                  📁 Selecionar pasta (temporada)
                </label>
                <label
                  htmlFor="camera-input"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md border border-emerald-700 bg-emerald-900/40 px-3 py-2 text-xs sm:text-sm font-medium text-emerald-200 hover:bg-emerald-800/60"
                >
                  📷 Gravar com câmera
                </label>
              </div>
            </div>
          </div>

          {/* Overall Progress */}
          {uploadFiles.length > 0 && (() => {
            const totalFiles = uploadFiles.length;
            const completedFiles = uploadFiles.filter((f) => f.status === "completed").length;
            const totalBytes = uploadFiles.reduce((sum, f) => sum + f.file.size, 0);
            const uploadedBytesTotal = uploadFiles.reduce(
              (sum, f) => sum + f.file.size * ((f.progress || 0) / 100),
              0,
            );
            const overallPercent = totalBytes > 0
              ? Math.round((uploadedBytesTotal / totalBytes) * 100)
              : 0;

            const activeUploads = uploadFiles.filter(
              (f) => f.status === "uploading" && f.uploadSpeed && f.uploadSpeed > 0,
            );

            let totalEtaSeconds: number | null = null;
            if (activeUploads.length > 0 && totalBytes > 0) {
              const avgSpeed =
                activeUploads.reduce((sum, f) => sum + (f.uploadSpeed || 0), 0) /
                activeUploads.length;
              const remainingBytes = totalBytes - uploadedBytesTotal;
              if (avgSpeed > 0 && remainingBytes > 0) {
                totalEtaSeconds = remainingBytes / avgSpeed;
              }
            }

            return (
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200">
                    Progresso geral: {completedFiles} de {totalFiles} arquivo(s)
                  </span>
                  <span className="text-zinc-400">{overallPercent}%</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${overallPercent}%` }}
                  />
                </div>
                {totalEtaSeconds !== null && totalEtaSeconds > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Tempo total estimado:</span>
                    <span className="font-mono">~{formatTime(totalEtaSeconds)}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-300">
                {uploadFiles.length} arquivo(s) selecionado(s):
              </p>
              {isSeriesLike
                ? (() => {
                    const bySeason = new Map<number | "none", UploadFile[]>();

                    for (const file of uploadFiles) {
                      const key = typeof file.seasonNumber === "number" ? file.seasonNumber : "none";
                      if (!bySeason.has(key)) {
                        bySeason.set(key, []);
                      }
                      bySeason.get(key)!.push(file);
                    }

                    const entries = Array.from(bySeason.entries()).sort(([a], [b]) => {
                      if (a === "none" && b === "none") return 0;
                      if (a === "none") return 1;
                      if (b === "none") return -1;
                      return a - b;
                    });

                    return entries.map(([seasonKey, files]) => {
                      const episodeSet = new Set<number>();
                      for (const file of files) {
                        if (typeof file.episodeNumber === "number") {
                          episodeSet.add(file.episodeNumber);
                        }
                      }

                      const episodeNumbers = Array.from(episodeSet).sort((a, b) => a - b);
                      let gapsLabel: string | null = null;

                      if (episodeNumbers.length > 1) {
                        const missing: number[] = [];
                        const start = episodeNumbers[0];
                        const end = episodeNumbers[episodeNumbers.length - 1];
                        for (let n = start; n <= end; n += 1) {
                          if (!episodeSet.has(n)) {
                            missing.push(n);
                          }
                        }

                        if (missing.length > 0) {
                          const formatted = missing
                            .map((n) => `E${n.toString().padStart(2, "0")}`)
                            .join(", ");
                          gapsLabel = missing.length === 1 ? `Falta ${formatted}` : `Faltam ${formatted}`;
                        }
                      }

                      const sortedFiles = [...files].sort((a, b) => {
                        const aHasEp = typeof a.episodeNumber === "number";
                        const bHasEp = typeof b.episodeNumber === "number";
                        if (aHasEp && bHasEp) {
                          return (a.episodeNumber as number) - (b.episodeNumber as number);
                        }
                        if (aHasEp) return -1;
                        if (bHasEp) return 1;
                        return 0;
                      });

                      return (
                        <div
                          key={seasonKey === "none" ? "none" : seasonKey.toString()}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-zinc-200">
                              {seasonKey === "none"
                                ? `Sem temporada (${files.length} arquivo(s))`
                                : `Temporada ${seasonKey} (${files.length} arquivo(s))`}
                            </span>
                            {gapsLabel && (
                              <span className="text-[11px] text-amber-400">{gapsLabel}</span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {sortedFiles.map((f) => {
                              const hasEpisodeInfo =
                                typeof f.seasonNumber === "number" &&
                                typeof f.episodeNumber === "number";

                              const matchedEpisode =
                                isSeriesLike && hasEpisodeInfo
                                  ? episodes.find(
                                      (ep) =>
                                        ep.seasonNumber === f.seasonNumber &&
                                        ep.episodeNumber === f.episodeNumber,
                                    )
                                  : null;

                              let episodeStatusLabel: string | null = null;
                              let episodeStatusClass = "";

                              if (matchedEpisode) {
                                if (matchedEpisode.hlsStatus === "hls_ready") {
                                  episodeStatusLabel = "HLS pronto";
                                  episodeStatusClass =
                                    "border-emerald-700 text-emerald-300 bg-emerald-900/40";
                                } else if (matchedEpisode.hlsStatus === "uploaded") {
                                  episodeStatusLabel = "Upload feito";
                                  episodeStatusClass =
                                    "border-blue-700 text-blue-300 bg-blue-900/40";
                                } else if (matchedEpisode.hlsStatus === "none") {
                                  episodeStatusLabel = "Sem upload";
                                  episodeStatusClass =
                                    "border-zinc-700 text-zinc-300 bg-zinc-900/60";
                                } else if (matchedEpisode.hlsStatus === "error") {
                                  episodeStatusLabel = "Erro";
                                  episodeStatusClass =
                                    "border-red-700 text-red-300 bg-red-900/40";
                                }
                              }

                              return (
                                <div
                                  key={f.id}
                                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4"
                                >
                                  <div className="flex-1">
                                    <p className="font-semibold text-zinc-100">{f.file.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                      <span>{formatBytes(f.file.size)}</span>
                                      {hasEpisodeInfo ? (
                                        <>
                                          <span className="text-emerald-400">
                                            • ✅ S{f.seasonNumber!.toString().padStart(2, "0")}E
                                            {f.episodeNumber!.toString().padStart(2, "0")}
                                          </span>
                                          {episodeStatusLabel && (
                                            <span
                                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${episodeStatusClass}`}
                                            >
                                              {episodeStatusLabel}
                                            </span>
                                          )}
                                        </>
                                      ) : f.status === "pending" ? (
                                        <span className="text-yellow-400 animate-pulse">
                                          • 🔍 Detectando...
                                        </span>
                                      ) : (
                                        <span className="text-red-400">• ⚠️ Não detectado</span>
                                      )}
                                    {/* Botões sempre visíveis */}
                                    {f.status !== "uploading" && f.status !== "completed" && (
                                      <>
                                        <button
                                          onClick={() => fixWithAI(f)}
                                          disabled={aiDetectingId === f.id}
                                          className="text-purple-400 hover:text-purple-300 underline disabled:opacity-50"
                                        >
                                          {aiDetectingId === f.id ? "🤖 Detectando..." : "🤖 IA"}
                                        </button>
                                        <button
                                          onClick={() => {
                                            const ep = prompt(
                                              "Número do episódio:",
                                              f.episodeNumber?.toString() || "1",
                                            );
                                            const season = prompt(
                                              "Temporada:",
                                              f.seasonNumber?.toString() || "1",
                                            );
                                            if (ep && season) {
                                              updateEpisode(f.id, parseInt(season, 10), parseInt(ep, 10));
                                            }
                                          }}
                                          className="text-blue-400 hover:text-blue-300 underline"
                                        >
                                          ✏️ Editar
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  {f.status === "uploading" && (
                                    <div className="mt-2 space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-400">
                                          {f.uploadedBytes && formatBytes(f.uploadedBytes)} / {formatBytes(f.file.size)}
                                        </span>
                                        <span className="text-emerald-400 font-mono">
                                          {f.uploadSpeed && formatSpeed(f.uploadSpeed)}
                                        </span>
                                      </div>
                                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-emerald-600 transition-all"
                                          style={{ width: `${f.progress}%` }}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-400">{f.progress}%</span>
                                        <div className="flex items-center gap-2">
                                          {typeof f.retryCount === "number" && f.retryCount > 1 && (
                                            <span className="text-[10px] text-amber-400">
                                              Tentativa {f.retryCount}/{MULTIPART_MAX_RETRIES}
                                            </span>
                                          )}
                                          {f.estimatedTimeLeft && f.estimatedTimeLeft > 0 && (
                                            <span className="text-zinc-500">
                                              ~{formatTime(f.estimatedTimeLeft)} restante
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {f.status === "completed" && (
                                    <p className="text-xs text-emerald-400 mt-1">✅ Upload concluído!</p>
                                  )}
                                  {f.status === "error" && (
                                    <p className="text-xs text-red-400 mt-1">❌ {f.error}</p>
                                  )}
                                  {f.status === "cancelled" && (
                                    <p className="text-xs text-zinc-400 mt-1">⏹ Upload cancelado.</p>
                                  )}
                                </div>
                                {f.status === "pending" && (
                                  <button
                                    onClick={() => removeFile(f.id)}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    🗑️
                                  </button>
                                )}
                                {f.status === "uploading" && (
                                  <button
                                    onClick={() => handleCancelUpload(f.id)}
                                    className="text-xs rounded-md border border-red-700 px-2 py-1 text-red-300 hover:bg-red-900/40"
                                  >
                                    ⏹ Cancelar
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                  })()
                : uploadFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-zinc-100">{f.file.name}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>{formatBytes(f.file.size)}</span>
                          {f.seasonNumber && f.episodeNumber ? (
                            <span className="text-emerald-400">
                              • ✅ S{f.seasonNumber.toString().padStart(2, "0")}E
                              {f.episodeNumber.toString().padStart(2, "0")}
                            </span>
                          ) : f.status === "pending" ? (
                            <span className="text-yellow-400 animate-pulse">
                              • 🔍 Detectando...
                            </span>
                          ) : (
                            <span className="text-red-400">• ⚠️ Não detectado</span>
                          )}
                          {/* Botões sempre visíveis */}
                          {f.status !== "uploading" && f.status !== "completed" && (
                            <>
                              <button
                                onClick={() => fixWithAI(f)}
                                disabled={aiDetectingId === f.id}
                                className="text-purple-400 hover:text-purple-300 underline disabled:opacity-50"
                              >
                                {aiDetectingId === f.id ? "🤖 Detectando..." : "🤖 IA"}
                              </button>
                              <button
                                onClick={() => {
                                  const ep = prompt(
                                    "Número do episódio:",
                                    f.episodeNumber?.toString() || "1",
                                  );
                                  const season = prompt(
                                    "Temporada:",
                                    f.seasonNumber?.toString() || "1",
                                  );
                                  if (ep && season) {
                                    updateEpisode(f.id, parseInt(season, 10), parseInt(ep, 10));
                                  }
                                }}
                                className="text-blue-400 hover:text-blue-300 underline"
                              >
                                ✏️ Editar
                              </button>
                            </>
                          )}
                        </div>
                        {f.status === "uploading" && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400">
                                {f.uploadedBytes && formatBytes(f.uploadedBytes)} / {formatBytes(f.file.size)}
                              </span>
                              <span className="text-emerald-400 font-mono">
                                {f.uploadSpeed && formatSpeed(f.uploadSpeed)}
                              </span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 transition-all"
                                style={{ width: `${f.progress}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400">{f.progress}%</span>
                              <div className="flex items-center gap-2">
                                {typeof f.retryCount === "number" && f.retryCount > 1 && (
                                  <span className="text-[10px] text-amber-400">
                                    Tentativa {f.retryCount}/{MULTIPART_MAX_RETRIES}
                                  </span>
                                )}
                                {f.estimatedTimeLeft && f.estimatedTimeLeft > 0 && (
                                  <span className="text-zinc-500">
                                    ~{formatTime(f.estimatedTimeLeft)} restante
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {f.status === "completed" && (
                          <p className="text-xs text-emerald-400 mt-1">✅ Upload concluído!</p>
                        )}
                        {f.status === "error" && (
                          <p className="text-xs text-red-400 mt-1">❌ {f.error}</p>
                        )}
                        {f.status === "cancelled" && (
                          <p className="text-xs text-zinc-400 mt-1">⏹ Upload cancelado.</p>
                        )}
                      </div>
                      {f.status === "pending" && (
                        <button
                          onClick={() => removeFile(f.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          🗑️
                        </button>
                      )}
                      {f.status === "uploading" && (
                        <button
                          onClick={() => handleCancelUpload(f.id)}
                          className="text-xs rounded-md border border-red-700 px-2 py-1 text-red-300 hover:bg-red-900/40"
                        >
                          ⏹ Cancelar
                        </button>
                      )}
                    </div>
                  ))}
            </div>
          )}

          {/* Options */}
          <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
            <p className="text-sm font-semibold text-zinc-300">⚙️ Opções</p>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={autoTranscode}
                onChange={(e) => setAutoTranscode(e.target.checked)}
                className="rounded"
              />
              Transcodificar automaticamente após upload
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={deleteSource}
                onChange={(e) => setDeleteSource(e.target.checked)}
                className="rounded"
              />
              Deletar arquivo original após transcodificação
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={queueUploads}
                onChange={(e) => setQueueUploads(e.target.checked)}
                className="rounded"
              />
              Fazer upload em fila (1 arquivo por vez)
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={notifyOnComplete}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  if (!checked) {
                    setNotifyOnComplete(false);
                    return;
                  }

                  const granted = await ensureNotificationPermission();
                  if (!granted) {
                    setNotifyOnComplete(false);
                    setInfo(
                      "Navegador não permitiu notificações de desktop. Verifique as permissões do site.",
                    );
                    return;
                  }

                  setNotifyOnComplete(true);
                }}
                className="rounded"
              />
              Notificar quando uploads/transcodificação iniciarem
            </label>
            <div className="flex items-center gap-4">
              <label className="text-sm text-zinc-300">CRF (qualidade):</label>
              <input
                type="range"
                min="16"
                max="30"
                value={crf}
                onChange={(e) => setCrf(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono text-zinc-400">{crf}</span>
            </div>
          </div>

          {/* Upload Button */}
          <button
            onClick={startUpload}
            disabled={uploadFiles.length === 0 || uploadFiles.some((f) => f.status === "uploading")}
            className="w-full rounded-md bg-emerald-600 px-6 py-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            🚀 Fazer Upload e Processar Tudo
          </button>
        </div>
      )}
    </div>
  );
}
