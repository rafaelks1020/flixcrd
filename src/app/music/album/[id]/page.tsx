import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Disc } from "lucide-react";
import { CoverImage } from "@/components/music/CoverImage";
import { PlayButton } from "@/components/music/PlayButton";
import { TrackRow } from "@/components/music/TrackRow";
import { getAlbumById, getArtistById, getTracksForAlbum } from "@/lib/music/catalog-db";
import { requireMusicPage } from "@/lib/music/page-access";

export const metadata = { title: "Álbum" };

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMusicPage(`/music/album/${id}`);
  const album = await getAlbumById(id);
  if (!album) notFound();
  const artist = await getArtistById(album.artistId);
  const tracks = await getTracksForAlbum(album.id);

  return (
    <div className="space-y-8 pb-8">
      <Link href="/music" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-400 hover:text-white">
        <ArrowLeft size={14} /> Voltar
      </Link>
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="relative h-56 w-56 shrink-0 overflow-hidden rounded-3xl ring-1 ring-white/10 sm:h-72 sm:w-72">
          <CoverImage src={album.coverUrl} alt={album.title} className="absolute inset-0" />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-fuchsia-300">Álbum</div>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">{album.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-lg text-zinc-300">
            {artist ? <Link href={`/music/artist/${artist.id}`} className="font-semibold text-white hover:text-fuchsia-200">{artist.name}</Link> : <span>Artista</span>}
            <span className="text-zinc-600">·</span>
            <span>{album.year}</span>
            <span className="text-zinc-600">·</span>
            <span>{tracks.length} faixas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeof album.rating?.score === "number" && (
              <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-xs text-fuchsia-200">{album.rating.score.toFixed(1)}</span>
            )}
            {album.genres.map((genre) => (
              <span key={genre} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-200">{genre}</span>
            ))}
          </div>
          {tracks[0] && (
            <PlayButton trackId={tracks[0].id} albumId={album.id} source="album" label="Tocar álbum" className="inline-flex h-11 items-center rounded-full bg-fuchsia-500 px-6 text-sm font-semibold text-white" />
          )}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_0.8fr]">
        <div className="space-y-1">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              trackId={track.id}
              trackNumber={track.trackNumber || index + 1}
              title={track.title}
              artistName={track.artistName || artist?.name || "Artista"}
              duration={track.durationSec}
            />
          ))}
          {tracks.length === 0 && <p className="text-sm text-zinc-500">Este álbum não tem faixas prontas.</p>}
        </div>
        <aside className="h-fit space-y-4 rounded-2xl border border-white/10 bg-zinc-950 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-fuchsia-300"><Disc size={18} /></div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Gravadora</div>
              <div className="text-sm font-semibold">{album.label || "Independente"}</div>
            </div>
          </div>
          {album.description && <p className="border-t border-white/10 pt-4 text-sm leading-relaxed text-zinc-400">{album.description}</p>}
        </aside>
      </div>
    </div>
  );
}
