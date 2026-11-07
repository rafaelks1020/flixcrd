import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMusicAccess } from "@/lib/music/access";
import { musicError, id } from "@/lib/music/http";

// LRCLIB API - Gratuita, sem autenticação
const LRCLIB_API = "https://lrclib.net/api";

type LrcLibResponse = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

// GET /api/lyrics?trackId=xxx - Busca letras (do banco ou API externa)
export async function GET(req: NextRequest) {
  try {
  await requireMusicAccess();
  const url = new URL(req.url);
  const trackId = id(url.searchParams.get("trackId"), "trackId");

  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  // Busca track no banco
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    include: {
      artist: { select: { name: true } },
      album: { select: { title: true } },
    },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // Se já tem letras no banco, retorna
  if (track.lyricsLrc || track.lyricsPlain) {
    return NextResponse.json({
      trackId,
      hasLyrics: true,
      lyricsLrc: track.lyricsLrc,
      lyricsPlain: track.lyricsPlain,
      source: "database",
    });
  }

  // Busca na LRCLIB API
  try {
    const searchParams = new URLSearchParams({
      track_name: track.title,
      artist_name: track.artist.name,
      album_name: track.album.title,
      duration: String(track.durationSec),
    });

    const response = await fetch(`${LRCLIB_API}/get?${searchParams}`, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Pflix/1.0" },
    });

    if (!response.ok) {
      // Tenta busca mais genérica
      const searchResponse = await fetch(
        `${LRCLIB_API}/search?track_name=${encodeURIComponent(track.title)}&artist_name=${encodeURIComponent(track.artist.name)}`,
        { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Pflix/1.0" } }
      );

      if (!searchResponse.ok) {
        return NextResponse.json({
          trackId,
          hasLyrics: false,
          lyricsLrc: null,
          lyricsPlain: null,
          source: "not_found",
        });
      }

      const searchResults = (await searchResponse.json()) as LrcLibResponse[];
      if (!searchResults.length) {
        return NextResponse.json({
          trackId,
          hasLyrics: false,
          lyricsLrc: null,
          lyricsPlain: null,
          source: "not_found",
        });
      }

      // Usa o primeiro resultado
      const bestMatch = searchResults[0];
      
      // Salva no banco para cache
      if (bestMatch.syncedLyrics || bestMatch.plainLyrics) {
        await prisma.track.update({
          where: { id: trackId },
          data: {
            lyricsLrc: bestMatch.syncedLyrics,
            lyricsPlain: bestMatch.plainLyrics,
            hasLyrics: true,
          },
        });
      }

      return NextResponse.json({
        trackId,
        hasLyrics: !!(bestMatch.syncedLyrics || bestMatch.plainLyrics),
        lyricsLrc: bestMatch.syncedLyrics,
        lyricsPlain: bestMatch.plainLyrics,
        source: "lrclib",
      });
    }

    const data = (await response.json()) as LrcLibResponse;

    // Salva no banco para cache
    if (data.syncedLyrics || data.plainLyrics) {
      await prisma.track.update({
        where: { id: trackId },
        data: {
          lyricsLrc: data.syncedLyrics,
          lyricsPlain: data.plainLyrics,
          hasLyrics: true,
        },
      });
    }

    return NextResponse.json({
      trackId,
      hasLyrics: !!(data.syncedLyrics || data.plainLyrics),
      lyricsLrc: data.syncedLyrics,
      lyricsPlain: data.plainLyrics,
      source: "lrclib",
    });
  } catch (error) {
    console.error("Error fetching lyrics:", error);
    return NextResponse.json({
      trackId,
      hasLyrics: false,
      lyricsLrc: null,
      lyricsPlain: null,
      source: "error",
    });
  }
  } catch (error) { return musicError(error); }
}
