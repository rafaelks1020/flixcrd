import Link from "next/link";
import {
  Upload,
  Disc3,
  Music,
  Mic2,
  Database,
  Activity,
  Sparkles,
  FileText,
  ListMusic,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MusicAdminNav } from "@/components/admin/music/MusicAdminNav";

export const dynamic = "force-dynamic";

export default async function AdminMusicPage() {
  let artistCount = 0;
  let albumCount = 0;
  let trackCount = 0;
  let playlistCount = 0;
  let lyricsTrackCount = 0;
  let pendingTrackCount = 0;

  try {
    [
      artistCount,
      albumCount,
      trackCount,
      playlistCount,
      lyricsTrackCount,
      pendingTrackCount,
    ] = await Promise.all([
      prisma.artist.count(),
      prisma.album.count(),
      prisma.track.count(),
      prisma.playlist.count(),
      prisma.track.count({ where: { hasLyrics: true } }),
      prisma.track.count({ where: { status: "PENDING_METADATA" } }),
    ]);
  } catch {
    // Em ambiente sem banco conectado, exibe zero sem quebrar a renderizacao
  }

  const stats = [
    {
      label: "Artistas",
      value: artistCount,
      icon: Mic2,
      color: "from-fuchsia-500 to-violet-600",
    },
    {
      label: "Álbuns",
      value: albumCount,
      icon: Disc3,
      color: "from-pink-500 to-fuchsia-600",
    },
    {
      label: "Faixas",
      value: trackCount,
      icon: Music,
      color: "from-violet-500 to-purple-600",
    },
    {
      label: "Playlists",
      value: playlistCount,
      icon: ListMusic,
      color: "from-fuchsia-600 to-indigo-600",
    },
  ];

  const quickActions = [
    {
      href: "/admin/music/upload",
      label: "Upload ID3",
      desc: "Enviar músicas e letras LRC",
      icon: Upload,
      accent: true,
    },
    {
      href: "/admin/music/artists",
      label: "Artistas",
      desc: "Gerenciar artistas e MusicBrainz",
      icon: Mic2,
    },
    {
      href: "/admin/music/albums",
      label: "Álbuns",
      desc: "Gerenciar álbuns e capas",
      icon: Disc3,
    },
    {
      href: "/admin/music/tracks",
      label: "Faixas",
      desc: "Gerenciar faixas e letras",
      icon: Music,
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <MusicAdminNav />

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-zinc-950 via-fuchsia-950/20 to-zinc-950 p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/25">
              <Music size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-fuchsia-400">
                <Sparkles size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                  Pflix Music Admin
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Painel de Música
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm">
                Controle do catálogo musical, upload direto ao storage e enriquecimento MusicBrainz
              </p>
            </div>
          </div>
          <Link
            href="/music"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2.5 text-xs font-bold text-fuchsia-300 transition-colors hover:bg-fuchsia-500/20"
          >
            Abrir Player de Música
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-5 sm:p-6 transition-all hover:border-fuchsia-500/30 hover:bg-zinc-900/70"
          >
            <div
              className={`absolute top-0 right-0 h-28 w-28 bg-gradient-to-br ${stat.color} opacity-15 blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:opacity-25 transition-opacity`}
            />
            <div className="relative">
              <stat.icon size={20} className="text-fuchsia-400 mb-3" />
              <div className="text-2xl sm:text-3xl font-black text-white">
                {stat.value.toLocaleString("pt-BR")}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mt-1">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 flex items-center gap-2">
          <Activity size={14} className="text-fuchsia-400" />
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`group relative overflow-hidden rounded-2xl p-6 transition-all hover:scale-[1.01] ${
                action.accent
                  ? "bg-gradient-to-br from-fuchsia-500/20 to-violet-600/20 border border-fuchsia-500/40 hover:border-fuchsia-400"
                  : "bg-zinc-900/40 border border-white/10 hover:bg-zinc-900/70 hover:border-white/20"
              }`}
            >
              <div className="relative">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl mb-4 ${
                    action.accent
                      ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/25"
                      : "bg-white/5"
                  }`}
                >
                  <action.icon
                    size={22}
                    className={action.accent ? "text-white" : "text-fuchsia-400"}
                  />
                </div>
                <div className="font-bold text-white">{action.label}</div>
                <div className="text-xs text-zinc-400 mt-1">{action.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* System & Metadata Telemetry */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 flex items-center gap-2">
            <Database size={14} className="text-fuchsia-400" />
            Infraestrutura de Áudio
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-zinc-400">Storage</span>
              <span className="text-white font-mono text-xs bg-white/5 px-2.5 py-1 rounded-lg">
                prefixo music/
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-zinc-400">Capas de Álbuns e Artistas</span>
              <span className="text-white font-mono text-xs bg-white/5 px-2.5 py-1 rounded-lg">
                music/covers/
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-zinc-400">Entrega de Stream</span>
              <span className="text-fuchsia-300 font-mono text-xs flex items-center gap-1.5">
                <ShieldCheck size={14} />
                Presign 1h (302)
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 flex items-center gap-2">
            <FileText size={14} className="text-fuchsia-400" />
            Qualidade do Catálogo
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-zinc-400">Faixas com letras (LRC / ID3)</span>
              <span className="text-emerald-400 font-bold">
                {lyricsTrackCount.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-zinc-400">Metadados pendentes de revisão</span>
              <span className="text-amber-400 font-bold">
                {pendingTrackCount.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-zinc-400">Enriquecimento externo</span>
              <span className="text-zinc-300 text-xs flex items-center gap-1.5">
                <Clock size={12} className="text-fuchsia-400" />
                MusicBrainz + Cover Art Archive
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
