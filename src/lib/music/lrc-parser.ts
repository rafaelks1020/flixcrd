export type LrcLine = {
  time: number; // segundos
  text: string;
};

export type ParsedLrc = {
  title?: string;
  artist?: string;
  album?: string;
  lines: LrcLine[];
  plainText: string;
};

/**
 * Parse um arquivo LRC e retorna as linhas com timestamps
 * Formato LRC: [mm:ss.xx] texto da linha
 */
export function parseLrc(content: string): ParsedLrc {
  const lines: LrcLine[] = [];
  const metadata: Record<string, string> = {};
  const plainLines: string[] = [];

  const rawLines = content.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Metadados: [ti:Title], [ar:Artist], [al:Album]
    const metaMatch = trimmed.match(/^\[([a-z]{2}):(.+)\]$/i);
    if (metaMatch) {
      const [, tag, value] = metaMatch;
      metadata[tag.toLowerCase()] = value.trim();
      continue;
    }

    // Linhas com tempo: [mm:ss.xx] ou [mm:ss:xx] texto
    // Pode ter múltiplos timestamps: [00:15.00][00:30.00] texto
    const timestampRegex = /\[(\d{1,2}):(\d{2})([.:]\d{1,3})?\]/g;
    const timestamps: number[] = [];
    let match;
    let lastIndex = 0;

    while ((match = timestampRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = match[3] ? parseFloat(`0${match[3].replace(":", ".")}`) : 0;
      const time = minutes * 60 + seconds + ms;
      timestamps.push(time);
      lastIndex = timestampRegex.lastIndex;
    }

    if (timestamps.length > 0) {
      const text = trimmed.slice(lastIndex).trim();
      
      // Adicionar linha para cada timestamp (para linhas com múltiplos timestamps)
      for (const time of timestamps) {
        lines.push({ time, text });
      }

      if (text) {
        plainLines.push(text);
      }
    }
  }

  // Ordenar por tempo
  lines.sort((a, b) => a.time - b.time);

  return {
    title: metadata.ti,
    artist: metadata.ar,
    album: metadata.al,
    lines,
    plainText: plainLines.join("\n"),
  };
}

/**
 * Encontra a linha atual baseado no tempo de reprodução
 */
export function getCurrentLrcLine(lines: LrcLine[], currentTime: number): number {
  if (lines.length === 0) return -1;

  // Encontrar a última linha que começou antes do tempo atual
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].time <= currentTime) {
      return i;
    }
  }

  return -1;
}

/**
 * Formata tempo em segundos para formato LRC [mm:ss.xx]
 */
export function formatLrcTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `[${mins.toString().padStart(2, "0")}:${secs.toFixed(2).padStart(5, "0")}]`;
}

/**
 * Extrai o nome base do arquivo (sem extensão) para comparação
 */
export function getBaseFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").toLowerCase().trim();
}

/**
 * Verifica se dois nomes de arquivo correspondem (áudio e lrc)
 */
export function matchesAudioFile(lrcFilename: string, audioFilename: string): boolean {
  const lrcBase = getBaseFilename(lrcFilename);
  const audioBase = getBaseFilename(audioFilename);
  return lrcBase === audioBase;
}
