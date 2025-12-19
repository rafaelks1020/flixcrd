"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Clock, ShieldCheck, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceSnapshot {
  id: string;
  name: string;
  ok: boolean;
  details: string | null;
}

interface UptimeSummary {
  healthy: number;
  total: number;
  allHealthy: boolean;
  lastCheckAt: string;
}

interface HistorySnapshot {
  id: string;
  createdAt: string;
  healthy: number;
  total: number;
  allHealthy: boolean;
  services: ServiceSnapshot[];
}

export default function UptimeChart() {
  const [summary, setSummary] = useState<UptimeSummary | null>(null);
  const [services, setServices] = useState<ServiceSnapshot[]>([]);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadCurrentSnapshot();
    loadHistory();
    const interval = setInterval(loadCurrentSnapshot, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadCurrentSnapshot() {
    try {
      const res = await fetch("/api/admin/uptime");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || null);
        setServices(data.services || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await fetch("/api/admin/uptime/history?limit=48");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  }

  const orderedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [history]
  );

  if (loading && historyLoading) {
    return (
      <div className="rounded-[32px] border border-white/5 bg-zinc-900/20 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">Syncing Node Status</p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const healthyLabel = summary.allHealthy
    ? "Operational"
    : `${summary.healthy}/${summary.total} Running`;

  return (
    <div className="rounded-[40px] border border-white/5 bg-zinc-900/20 backdrop-blur-3xl p-8 md:p-10 space-y-10 shadow-2xl relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-16 translate-x-16" />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between relative z-10">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-primary mb-2">
            <Activity size={20} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">System Nodes</span>
          </div>
          <h3 className="text-3xl font-black tracking-tighter text-white">Service Health</h3>
          <p className="text-zinc-500 text-xs font-medium">Real-time status protocols and node availability metrics.</p>
        </div>

        <div className={cn(
          "px-6 py-3 rounded-2xl flex items-center gap-3 border shadow-xl transition-all",
          summary.allHealthy
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : summary.healthy > 0
              ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
        )}>
          <div className={cn("w-2 h-2 rounded-full", summary.allHealthy ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
          <span className="text-xs font-black uppercase tracking-widest">{healthyLabel}</span>
        </div>
      </div>

      {/* Services List HUD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <div
            key={service.id}
            className="group flex items-center justify-between rounded-2xl bg-black/40 border border-white/5 p-4 hover:border-white/10 transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-1.5 h-6 rounded-full",
                service.ok ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
              )} />
              <div className="space-y-0.5">
                <p className="text-xs font-black text-white group-hover:text-primary transition-colors">{service.name}</p>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">{service.details || (service.ok ? "Connected" : "Disconnected")}</p>
              </div>
            </div>
            {service.ok ? <ShieldCheck size={16} className="text-zinc-800" /> : <AlertCircle size={16} className="text-red-500" />}
          </div>
        ))}
      </div>

      {/* History Matrix */}
      <div className="space-y-4 pt-6 mt-6 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} />
            <span>Uptime Matrix (Last 24h)</span>
          </div>
          <span className="flex items-center gap-2">
            <Clock size={12} />
            Live Sync: {new Date(summary.lastCheckAt).toLocaleTimeString("pt-BR")}
          </span>
        </div>

        <div className="grid grid-cols-24 gap-1.5 h-12">
          {historyLoading ? (
            <div className="col-span-full flex items-center justify-center opacity-30"><Loader2 className="animate-spin" /></div>
          ) : orderedHistory.length === 0 ? (
            <div className="col-span-full h-full bg-zinc-900 animate-pulse rounded-xl" />
          ) : orderedHistory.map((snapshot) => (
            <motion.div
              key={snapshot.id}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              className="relative group"
            >
              <div className={cn(
                "h-full w-full rounded-md transition-all duration-300 cursor-help",
                snapshot.allHealthy ? "bg-emerald-500/40 hover:bg-emerald-500" :
                  snapshot.healthy > 0 ? "bg-yellow-500/40 hover:bg-yellow-500" :
                    "bg-red-500/40 hover:bg-red-500"
              )} />

              {/* Tooltip HUD */}
              <div className="invisible absolute bottom-full left-1/2 z-50 mb-4 w-48 -translate-x-1/2 p-4 rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 pointer-events-none">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Availability</span>
                    <span className="text-[10px] font-bold text-white">{Math.round((snapshot.healthy / snapshot.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(snapshot.healthy / snapshot.total) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-zinc-500 font-medium">{new Date(snapshot.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
