"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film,
  Users,
  ShieldCheck,
  PlayCircle,
  TrendingUp,
  ArrowRight,
  Tv,
  Monitor,
  Sparkles,
  Zap,
  Clock,
  ChevronRight,
  Database,
  CloudUpload,
  Cpu,
  UserPlus
} from "lucide-react";
import StatsCard from "@/components/admin/StatsCard";
import UptimeChart from "@/components/admin/UptimeChart";
import { cn } from "@/lib/utils";

interface Title {
  id: string;
  name: string;
  type: string;
  posterUrl: string | null;
  createdAt: string;
}

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    titlesCount: 0,
    titlesWithHlsCount: 0,
    usersCount: 0,
    adminsCount: 0,
    moviesCount: 0,
    seriesCount: 0,
    animesCount: 0,
  });
  const [recentTitles, setRecentTitles] = useState<Title[]>([]);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.ok) {
          const data = await res.json();
          setStats({
            titlesCount: data.titlesCount || 0,
            titlesWithHlsCount: data.titlesWithHlsCount || 0,
            usersCount: data.usersCount || 0,
            adminsCount: data.adminsCount || 0,
            moviesCount: data.moviesCount || 0,
            seriesCount: data.seriesCount || 0,
            animesCount: data.animesCount || 0,
          });
          setRecentTitles(data.recentTitles || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const hlsPercentage = stats.titlesCount > 0 ? Math.round((stats.titlesWithHlsCount / stats.titlesCount) * 100) : 0;

  const quickActions = [
    { href: "/admin/catalog", label: "Catálogo", desc: "Manage metadata & TMDB sync", icon: Film, color: "from-primary/20" },
    { href: "/admin/upload-v2", label: "Upload Center", desc: "Wasabi & S3 storage sync", icon: CloudUpload, color: "from-blue-500/20" },
    { href: "/admin/jobs", label: "HLS Forge", icon: Cpu, desc: "Transcoding queue status", color: "from-orange-500/20" },
    { href: "/admin/users", label: "Users", icon: UserPlus, desc: "Access & permission control", color: "from-emerald-500/20" },
  ];

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">Booting Analytics HUD</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-12 pb-20">
      {/* Header HUD */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-primary">
            <Sparkles size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Intelligence Dashboard</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">System Overview</h1>
          <p className="text-zinc-500 text-sm font-medium">Quick telemetry on catalogue flow, user acquisition, and HLS health.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-600 bg-zinc-900/40 px-4 py-2 rounded-full border border-white/5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Broadcast Active
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Catálogo Total"
          value={stats.titlesCount}
          icon={Database}
          color="red"
          trend={{ value: `${stats.moviesCount} Movies`, isPositive: true }}
        />
        <StatsCard
          title="HLS Ready"
          value={`${hlsPercentage}%`}
          icon={PlayCircle}
          color="green"
          trend={{ value: `${stats.titlesWithHlsCount} Ready`, isPositive: true }}
        />
        <StatsCard
          title="User Base"
          value={stats.usersCount}
          icon={Users}
          color="blue"
          trend={{ value: "Organic Growth", isPositive: true }}
        />
        <StatsCard
          title="Privileged Access"
          value={stats.adminsCount}
          icon={ShieldCheck}
          color="purple"
          trend={{ value: "Verified Admins", isPositive: true }}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Col: Uptime & Actions */}
        <div className="lg:col-span-2 space-y-8">
          <UptimeChart />

          <div className="space-y-6">
            <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-3">
              <Zap className="text-primary" size={20} />
              Quick Access Protocols
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {quickActions.map((action, i) => (
                <Link key={i} href={action.href} className="group glass-card bg-zinc-900/20 border border-white/5 p-6 rounded-[32px] flex items-center justify-between hover:border-primary/50 transition-all duration-500 hover:scale-[1.02] relative overflow-hidden">
                  <div className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity")} />
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-2xl bg-zinc-950 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors bg-gradient-to-br", action.color)}>
                      <action.icon size={24} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-black text-white">{action.label}</p>
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">{action.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="text-zinc-800 group-hover:text-primary group-hover:translate-x-1 transition-all" size={20} />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Recent Activity */}
        <div className="glass-card bg-zinc-900/20 border border-white/5 p-8 rounded-[40px] space-y-8 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-3">
              <Clock className="text-zinc-500" size={18} />
              Latest Ingestions
            </h3>
            <Link href="/admin/catalog" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">View All</Link>
          </div>

          {recentTitles.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-4">
              <Film className="text-zinc-800" size={48} />
              <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">No recent data</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTitles.map((title) => (
                <div
                  key={title.id}
                  className="flex items-center gap-4 rounded-2xl bg-black/40 border border-white/5 p-3 group hover:border-white/10 transition-all"
                >
                  <div className="relative w-12 h-16 rounded-xl overflow-hidden shrink-0 shadow-xl">
                    {title.posterUrl ? (
                      <img src={title.posterUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-600">NULL</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white truncate group-hover:text-primary transition-colors">{title.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black uppercase text-zinc-600 tracking-tighter bg-white/5 px-2 py-0.5 rounded-md">{title.type}</span>
                      <span className="text-[9px] font-bold text-zinc-800 uppercase tracking-tighter" suppressHydrationWarning>
                        {new Date(title.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-zinc-700 hover:text-white hover:bg-white/5 transition-all">
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto pt-6 border-t border-white/5">
            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="text-primary" size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Conversion Insight</span>
              </div>
              <p className="text-[11px] font-medium text-zinc-400 leading-relaxed">
                Catálogo está <span className="text-white font-bold">{hlsPercentage}%</span> otimizado para streaming adaptativo. Priorize transcodificação de séries pendentes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
