import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/music/AlbumCard";
import { CoverImage } from "@/components/music/CoverImage";
import { getAlbumsForArtist, getArtistById } from "@/lib/music/catalog-db";
import { requireMusicPage } from "@/lib/music/page-access";

export const metadata = { title: "Artista" };

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMusicPage(`/music/artist/${id}`);
  const artist = await getArtistById(id);
  if (!artist) notFound();
  const albums = await getAlbumsForArtist(artist.id);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
        <div className="relative h-48 sm:h-60">
          <CoverImage src={artist.bannerUrl || artist.pictureUrl} alt="" className="absolute inset-0 opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex items-end gap-4 p-4 sm:p-6">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20 sm:h-24 sm:w-24">
              <CoverImage src={artist.pictureUrl} alt={artist.name} className="absolute inset-0" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-fuchsia-300">Artista</div>
              <h1 className="truncate text-3xl font-black sm:text-4xl">{artist.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                {typeof artist.rating?.score === "number" && (
                  <span className="rounded-full bg-black/50 px-2 py-0.5 text-xs text-fuchsia-200">{artist.rating.score.toFixed(1)}</span>
                )}
                {artist.genres.map((genre) => (
                  <span key={genre} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-200">{genre}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {artist.bio ? (
        <section className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
          <h2 className="text-sm font-semibold">Bio</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{artist.bio}</p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Álbuns</h2>
        {albums.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum álbum deste artista.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                href={`/music/album/${album.id}`}
                title={album.title}
                subtitle={String(album.year)}
                coverUrl={album.coverUrl}
                score={album.rating?.score}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
