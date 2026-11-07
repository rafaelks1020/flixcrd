import Link from "next/link";
import { Music2, TrendingUp, Users2 } from "lucide-react";
import { AlbumCard } from "@/components/music/AlbumCard";
import { ContinueListening } from "@/components/music/ContinueListening";
import { PlayRadioButton } from "@/components/music/PlayRadioButton";
import { Recommendations } from "@/components/music/Recommendations";
import { listAlbums, listTrendingAlbums } from "@/lib/music/catalog-db";
import { requireMusicPage } from "@/lib/music/page-access";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Música" };

function firstName(name: string | null, email: string | null) {
  if (name?.trim()) return name.trim().split(/\s+/)[0];
  const local = (email || "").split("@")[0].replace(/[._]/g, " ").replace(/\d+/g, "").trim();
  if (!local) return "ouvinte";
  return local
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default async function MusicHomePage() {
  const session = await requireMusicPage("/music");

  let recent: Awaited<ReturnType<typeof listAlbums>> = [];
  let trending: Awaited<ReturnType<typeof listTrendingAlbums>> = [];
  let stats = { artists: 0, albums: 0, tracks: 0 };

  try {
    const [albums, popular, counts] = await Promise.all([
      listAlbums({ limit: 12 }),
      listTrendingAlbums({ limit: 12 }),
      Promise.all([prisma.artist.count(), prisma.album.count(), prisma.track.count()]),
    ]);
    recent = albums;
    trending = popular.length > 0 ? popular : albums;
    stats = { artists: counts[0], albums: counts[1], tracks: counts[2] };
  } catch {
    recent = [];
    trending = [];
  }

  const cards = (items: typeof recent) =>
    items.map((album) => (
      <AlbumCard
        key={album.id}
        href={`/music/album/${album.id}`}
        title={album.title}
        subtitle={album.artistName || String(album.year)}
        coverUrl={album.coverUrl}
        score={album.rating?.score}
      />
    ));

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 px-5 py-10 sm:px-10">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="relative max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
            <Music2 size={14} /> Música
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Olá, {firstName(session.name, session.email)}</h1>
          <p className="max-w-xl text-sm text-zinc-400 sm:text-base">
            Álbuns, artistas e playlists no mesmo Pflix dos seus filmes e séries.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <PlayRadioButton />
            <Link href="/music/search" className="inline-flex h-11 items-center rounded-full border border-white/15 px-6 text-sm font-semibold text-white">
              Explorar
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10">
        {[
          { label: "Artistas", value: stats.artists, icon: <Users2 size={14} /> },
          { label: "Álbuns", value: stats.albums, icon: <TrendingUp size={14} /> },
          { label: "Músicas", value: stats.tracks, icon: <Music2 size={14} /> },
        ].map((item) => (
          <div key={item.label} className="bg-zinc-950 px-3 py-4 text-center">
            <div className="mb-1 flex justify-center text-fuchsia-300/80">{item.icon}</div>
            <div className="text-lg font-black sm:text-2xl">{item.value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{item.label}</div>
          </div>
        ))}
      </section>

      <ContinueListening />
      <Recommendations />

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Adicionados recentemente</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">{cards(recent)}</div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Tendências</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">{cards(trending)}</div>
        </section>
      )}

      {recent.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-10 text-center text-sm text-zinc-400">
          O catálogo de música ainda está vazio.
        </p>
      )}
    </div>
  );
}
