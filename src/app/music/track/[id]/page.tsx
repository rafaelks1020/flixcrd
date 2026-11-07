import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverImage } from "@/components/music/CoverImage";
import { FavoriteButton } from "@/components/music/FavoriteButton";
import { PlayButton } from "@/components/music/PlayButton";
import { getAlbumById, getArtistById, getTrackById } from "@/lib/music/catalog-db";
import { requireMusicPage } from "@/lib/music/page-access";
import { formatClock } from "@/components/music/player-types";

export const metadata = { title: "Faixa" };

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMusicPage(`/music/track/${id}`);
  const track = await getTrackById(id);
  if (!track) notFound();
  const [album, artist] = await Promise.all([getAlbumById(track.albumId), getArtistById(track.artistId)]);

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-950 p-5 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10">
          <CoverImage src={album?.coverUrl} alt={track.title} className="absolute inset-0" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-fuchsia-300">Faixa</div>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">{track.title}</h1>
          <div className="mt-2 text-sm text-zinc-300">
            {artist && <Link href={`/music/artist/${artist.id}`} className="hover:text-white">{artist.name}</Link>}
            {album && (
              <>
                <span className="text-zinc-600"> · </span>
                <Link href={`/music/album/${album.id}`} className="hover:text-white">{album.title}</Link>
              </>
            )}
            <span className="text-zinc-600"> · </span>
            <span>{formatClock(track.durationSec)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {typeof track.rating?.score === "number" && (
              <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-xs text-fuchsia-200">{track.rating.score.toFixed(1)}</span>
            )}
            {track.genres.map((genre) => (
              <span key={genre} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{genre}</span>
            ))}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs uppercase">{track.format}</span>
          </div>
          {track.description && <p className="mt-4 text-sm text-zinc-400">{track.description}</p>}
          <div className="mt-5 flex items-center gap-4">
            <PlayButton trackId={track.id} albumId={track.albumId} source="album" label="Tocar" className="inline-flex h-11 items-center rounded-full bg-fuchsia-500 px-6 text-sm font-semibold text-white" />
            <FavoriteButton trackId={track.id} size={22} showText />
          </div>
        </div>
      </div>
    </section>
  );
}
