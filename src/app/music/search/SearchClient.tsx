"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Disc3, Filter, Mic2, Music, Play, Search, TrendingUp, X } from "lucide-react";
import { AlbumCard } from "@/components/music/AlbumCard";
import { ArtistCard } from "@/components/music/ArtistCard";
import { CoverImage } from "@/components/music/CoverImage";
import { PlayButton } from "@/components/music/PlayButton";

type SearchArtist = { id: string; name: string; pictureUrl?: string | null };
type SearchAlbum = { id: string; title: string; artistName?: string; coverUrl?: string | null; rating?: { score: number } };
type SearchTrack = { id: string; title: string; artistName?: string; albumTitle?: string; albumId: string; rating?: { score: number } };
type ChartTrack = {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  coverUrl: string;
  streamUrl: string | null;
  catalogTrackId: string | null;
};

export function SearchClient({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchAlbum[]>([]);
  const [results, setResults] = useState<{ artists: SearchArtist[]; albums: SearchAlbum[]; tracks: SearchTrack[] }>({ artists: [], albums: [], tracks: [] });
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [charts, setCharts] = useState<ChartTrack[]>([]);
  const [activeTab, setActiveTab] = useState<"search" | "charts">("search");
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    fetch("/api/music/catalog/search?type=genres")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data?.genres)) setGenres(data.genres); })
      .catch(() => {});
    fetch("/api/music/charts")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data?.tracks)) setCharts(data.tracks); })
      .catch(() => setCharts([]));
  }, []);

  useEffect(() => {
    if (q.trim()) return;
    let cancelled = false;
    setLoadingSuggestions(true);
    fetch("/api/music/catalog/albums?limit=60")
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setSuggestions(Array.isArray(data?.albums) ? data.albums : []); })
      .catch(() => { if (!cancelled) setSuggestions([]); })
      .finally(() => { if (!cancelled) setLoadingSuggestions(false); });
    return () => { cancelled = true; };
  }, [q]);

  useEffect(() => {
    const query = q.trim();
    if (!query && !selectedGenre) {
      setResults({ artists: [], albums: [], tracks: [] });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (selectedGenre) params.set("genre", selectedGenre);
      fetch(`/api/music/catalog/search?${params}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setResults({
            artists: Array.isArray(data?.artists) ? data.artists : [],
            albums: Array.isArray(data?.albums) ? data.albums : [],
            tracks: Array.isArray(data?.tracks) ? data.tracks : [],
          });
        })
        .catch(() => {});
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, selectedGenre]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button type="button" onClick={() => setActiveTab("search")} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "search" ? "bg-white text-black" : "bg-white/5 text-zinc-300"}`}>
          <Search size={14} className="mr-1 inline" /> Buscar
        </button>
        <button type="button" onClick={() => setActiveTab("charts")} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "charts" ? "bg-fuchsia-500 text-white" : "bg-white/5 text-zinc-300"}`}>
          <TrendingUp size={14} className="mr-1 inline" /> Top 50
        </button>
      </div>

      {activeTab === "search" ? (
        <>
          <div className="rounded-2xl bg-zinc-900/80 p-4 ring-1 ring-white/10 sm:p-6">
            <div className="flex items-center gap-3">
              <Search size={22} className="shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300">Buscar</label>
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Música, artista, álbum..."
                  className="w-full bg-transparent text-xl font-bold text-white outline-none placeholder:text-zinc-600 sm:text-3xl"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${showFilters || selectedGenre ? "bg-fuchsia-500 text-white" : "bg-white/10 text-zinc-300"}`}
                aria-label="Filtros"
              >
                <Filter size={18} />
              </button>
            </div>
            {showFilters && genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                {genres.slice(0, 24).map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => setSelectedGenre(selectedGenre === genre ? null : genre)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedGenre === genre ? "bg-fuchsia-500 text-white" : "bg-white/5 text-zinc-300"}`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            )}
            {selectedGenre && (
              <button type="button" onClick={() => setSelectedGenre(null)} className="mt-3 inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs text-fuchsia-200">
                {selectedGenre} <X size={12} />
              </button>
            )}
          </div>

          {!q.trim() && !selectedGenre ? (
            <section className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Sugestões</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {suggestions.map((album) => (
                  <AlbumCard key={album.id} href={`/music/album/${album.id}`} title={album.title} subtitle={album.artistName || ""} coverUrl={album.coverUrl} score={album.rating?.score} className="w-full sm:w-full" />
                ))}
              </div>
              {loadingSuggestions && <p className="text-sm text-zinc-500">Carregando...</p>}
            </section>
          ) : (
            <div className="space-y-10">
              {results.artists.length > 0 && (
                <section className="space-y-4">
                  <h2 className="flex items-center gap-2 text-xl font-bold"><Mic2 size={18} className="text-fuchsia-400" /> Artistas</h2>
                  <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
                    {results.artists.map((artist) => (
                      <ArtistCard key={artist.id} href={`/music/artist/${artist.id}`} name={artist.name} pictureUrl={artist.pictureUrl} />
                    ))}
                  </div>
                </section>
              )}
              {results.albums.length > 0 && (
                <section className="space-y-4">
                  <h2 className="flex items-center gap-2 text-xl font-bold"><Disc3 size={18} className="text-fuchsia-400" /> Álbuns</h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {results.albums.map((album) => (
                      <AlbumCard key={album.id} href={`/music/album/${album.id}`} title={album.title} subtitle={album.artistName || ""} coverUrl={album.coverUrl} score={album.rating?.score} className="w-full sm:w-full" />
                    ))}
                  </div>
                </section>
              )}
              {results.tracks.length > 0 && (
                <section className="space-y-4">
                  <h2 className="flex items-center gap-2 text-xl font-bold"><Music size={18} className="text-fuchsia-400" /> Músicas</h2>
                  <div className="divide-y divide-white/5 rounded-2xl bg-zinc-950 px-3 ring-1 ring-white/10">
                    {results.tracks.map((track) => (
                      <div key={track.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <Link href={`/music/track/${track.id}`} className="block truncate font-semibold hover:text-fuchsia-200">{track.title}</Link>
                          <div className="truncate text-xs text-zinc-400">{track.artistName} · {track.albumTitle}</div>
                        </div>
                        {typeof track.rating?.score === "number" && <span className="hidden text-xs text-fuchsia-200 sm:inline">{track.rating.score.toFixed(1)}</span>}
                        <PlayButton trackId={track.id} albumId={track.albumId} source="search" className="flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-500 text-white">
                          <Play size={16} fill="currentColor" />
                        </PlayButton>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {results.artists.length === 0 && results.albums.length === 0 && results.tracks.length === 0 && (
                <p className="py-12 text-center text-sm text-zinc-400">Nenhum resultado encontrado.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-black">Top 50 global</h2>
            <p className="text-sm text-zinc-400">Rankings do Deezer. Só toca o que existe no catálogo.</p>
          </div>
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-white/10">
            {charts.slice(0, 50).map((track, index) => (
              <div key={track.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <div className="w-6 text-center text-sm font-semibold text-zinc-500">{index + 1}</div>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <CoverImage src={track.coverUrl} alt="" className="absolute inset-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{track.title}</div>
                  <div className="truncate text-xs text-zinc-400">{track.artistName} · {track.albumTitle}</div>
                </div>
                {track.catalogTrackId && track.streamUrl ? (
                  <PlayButton trackId={track.catalogTrackId} source="search" className="flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-500 text-white" label="Tocar do catálogo">
                    <Play size={16} fill="currentColor" />
                  </PlayButton>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">Fora do catálogo</span>
                )}
              </div>
            ))}
            {charts.length === 0 && <p className="px-4 py-10 text-center text-sm text-zinc-500">Ranking indisponível agora.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
