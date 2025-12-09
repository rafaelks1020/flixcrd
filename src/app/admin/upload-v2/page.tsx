"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  uploadSpeed?: number; // bytes per second
  uploadedBytes?: number;
  startTime?: number;
  estimatedTimeLeft?: number; // seconds
}

interface CreatedTitle {
  id: string;
  name: string;
  slug: string;
  type: TitleType;
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
// IMPORTANTE: chamadas diretas para provedores de IA com API key NUNCA devem ficar no client.
// Por enquanto, desabilitamos o fallback de IA para não expor segredos.
// Se quiser reativar no futuro, crie uma rota de API server-side que use variáveis
// de ambiente (ex.: GROQ_API_KEY) e chame essa rota a partir daqui.
async function detectEpisodeWithAI(_filename: string): Promise<ParseResult | null> {
  return null;
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

  // Options
  const [autoTranscode, setAutoTranscode] = useState(true);
  const [deleteSource, setDeleteSource] = useState(true);
  const [crf, setCrf] = useState(20);

  // Status
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.message ?? "Erro ao consultar TMDb");
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
    } catch (err: any) {
      setError(err.message ?? "Erro ao criar título");
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
    // Primeiro adiciona os arquivos com status "detecting"
    const initialFiles: UploadFile[] = files.map((file) => ({
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
    const result = await detectEpisodeWithAI(uploadFile.file.name);
    if (result && result.episode !== null && result.episode !== undefined) {
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, seasonNumber: result.season || 1, episodeNumber: result.episode! }
            : f
        )
      );
    }
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

    for (const uploadFile of uploadFiles) {
      await uploadSingleFile(uploadFile);
    }

    setInfo("✅ Todos os uploads concluídos!");

    if (autoTranscode) {
      setInfo("🎬 Iniciando transcodificação automática...");
      await startTranscoding();
    }
  }

  async function uploadSingleFile(uploadFile: UploadFile) {
    try {
      // Update status
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

      // Get upload URL
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

      // Upload file
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", uploadFile.file.type || "application/octet-stream");

        let lastLoaded = 0;
        let lastTime = Date.now();

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000; // seconds
          const bytesDiff = event.loaded - lastLoaded;
          
          // Calculate speed (bytes per second)
          const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
          
          // Calculate estimated time left
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
            resolve();
          } else {
            reject(new Error(`Upload falhou: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Erro de rede"));
        xhr.send(uploadFile.file);
      });
    } catch (err: any) {
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "error", error: err.message }
            : f
        )
      );
    }
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
      }
    } catch (err: any) {
      setError(err.message ?? "Erro ao iniciar transcodificação");
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 max-w-5xl">
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

      {/* Step 1: TMDB Search */}
      {!selectedTmdb && !createdTitle && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
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
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
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

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? "border-emerald-600 bg-emerald-950/20"
                : "border-zinc-700 bg-zinc-900/50"
            }`}
          >
            <input
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileInput}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <div className="text-4xl mb-4">📁</div>
              <p className="text-lg font-semibold text-zinc-100 mb-2">
                Arraste arquivos aqui ou clique para selecionar
              </p>
              <p className="text-sm text-zinc-400">
                Aceita: .mkv, .mp4, .avi, .mov, .webm
              </p>
            </label>
          </div>

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-300">
                {uploadFiles.length} arquivo(s) selecionado(s):
              </p>
              {uploadFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4"
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
                            className="text-purple-400 hover:text-purple-300 underline"
                          >
                            🤖 IA
                          </button>
                          <button
                            onClick={() => {
                              const ep = prompt("Número do episódio:", f.episodeNumber?.toString() || "1");
                              const season = prompt("Temporada:", f.seasonNumber?.toString() || "1");
                              if (ep && season) {
                                updateEpisode(f.id, parseInt(season), parseInt(ep));
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
                          {f.estimatedTimeLeft && f.estimatedTimeLeft > 0 && (
                            <span className="text-zinc-500">
                              ~{formatTime(f.estimatedTimeLeft)} restante
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {f.status === "completed" && (
                      <p className="text-xs text-emerald-400 mt-1">✅ Upload concluído!</p>
                    )}
                    {f.status === "error" && (
                      <p className="text-xs text-red-400 mt-1">❌ {f.error}</p>
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
