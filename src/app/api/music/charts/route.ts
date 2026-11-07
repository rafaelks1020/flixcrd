import { NextResponse } from "next/server";
import { requireMusicAccess } from "@/lib/music/access";
import { prisma } from "@/lib/prisma";
import { streamUrl } from "@/lib/music/http";
import { musicError } from "@/lib/music/http";

// Cache para charts do Deezer (atualiza a cada hora)
let chartsCache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

type DeezerTrack = {
  id: number;
  title: string;
  duration: number;
  artist: {
    id: number;
    name: string;
    picture_medium: string;
  };
  album: {
    id: number;
    title: string;
    cover_medium: string;
  };
  position: number;
};

type DeezerAlbum = {
  id: number;
  title: string;
  cover_medium: string;
  artist: {
    id: number;
    name: string;
    picture_medium: string;
  };
  position: number;
};

type DeezerArtist = {
  id: number;
  name: string;
  picture_medium: string;
  position: number;
};

export async function GET(req: Request) {
  try {
  await requireMusicAccess();

  try {
    // Verificar cache
    if (chartsCache && Date.now() - chartsCache.timestamp < CACHE_DURATION) {
      return NextResponse.json(chartsCache.data);
    }

    // Buscar charts do Deezer
    const [tracksRes, albumsRes, artistsRes] = await Promise.all([
      fetch("https://api.deezer.com/chart/0/tracks?limit=50", { signal: AbortSignal.timeout(10000) }),
      fetch("https://api.deezer.com/chart/0/albums?limit=30", { signal: AbortSignal.timeout(10000) }),
      fetch("https://api.deezer.com/chart/0/artists?limit=20", { signal: AbortSignal.timeout(10000) }),
    ]);

    if (![tracksRes, albumsRes, artistsRes].every(r => r.ok)) throw new Error("Deezer indisponível");
    const [tracksData, albumsData, artistsData] = await Promise.all([
      tracksRes.json(),
      albumsRes.json(),
      artistsRes.json(),
    ]);

    const remoteTracks: DeezerTrack[] = tracksData.data || [];
    const localTracks = await prisma.track.findMany({
      where: { status: "READY", title: { in: remoteTracks.map(t => t.title), mode: "insensitive" } },
      select: { id: true, title: true, artist: { select: { name: true } } },
    });
    const charts = {
      tracks: remoteTracks.map((t: DeezerTrack) => {
        const local = localTracks.find(l => l.title.toLowerCase() === t.title.toLowerCase() && l.artist.name.toLowerCase() === t.artist.name.toLowerCase());
        return ({
        id: `deezer-${t.id}`,
        title: t.title,
        artistName: t.artist.name,
        artistId: `deezer-artist-${t.artist.id}`,
        albumTitle: t.album.title,
        albumId: `deezer-album-${t.album.id}`,
        coverUrl: t.album.cover_medium,
        artistPicture: t.artist.picture_medium,
        duration: t.duration,
        streamUrl: local ? streamUrl(local.id) : null,
        catalogTrackId: local?.id ?? null,
        position: t.position,
        source: "deezer",
      }); }),
      albums: (albumsData.data || []).map((a: DeezerAlbum) => ({
        id: `deezer-album-${a.id}`,
        title: a.title,
        artistName: a.artist.name,
        artistId: `deezer-artist-${a.artist.id}`,
        coverUrl: a.cover_medium,
        position: a.position,
        source: "deezer",
      })),
      artists: (artistsData.data || []).map((a: DeezerArtist) => ({
        id: `deezer-artist-${a.id}`,
        name: a.name,
        pictureUrl: a.picture_medium,
        position: a.position,
        source: "deezer",
      })),
      updatedAt: new Date().toISOString(),
    };

    // Salvar no cache
    chartsCache = { data: charts, timestamp: Date.now() };

    return NextResponse.json(charts);
  } catch (error) {
    console.error("Erro ao buscar rankings do Deezer:", error);
    
    // Retornar cache antigo se disponível
    if (chartsCache) {
      return NextResponse.json({ ...chartsCache.data, stale: true });
    }
    
    return NextResponse.json(
      { error: "Não foi possível buscar os rankings", tracks: [], albums: [], artists: [] },
      { status: 500 }
    );
  }
  } catch (error) { return musicError(error); }
}
