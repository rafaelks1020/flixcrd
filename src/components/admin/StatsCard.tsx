"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: any; // Lucide icon
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: "blue" | "green" | "purple" | "orange" | "red";
}

export default function StatsCard({ title, value, icon: Icon, trend, color = "red" }: StatsCardProps) {
  const themes = {
    blue: "from-blue-500/10 to-transparent border-blue-500/20 text-blue-400 shadow-blue-500/5",
    green: "from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400 shadow-emerald-500/5",
    purple: "from-purple-500/10 to-transparent border-purple-500/20 text-purple-400 shadow-purple-500/5",
    orange: "from-orange-500/10 to-transparent border-orange-500/20 text-orange-400 shadow-orange-500/5",
    red: "from-primary/10 to-transparent border-primary/20 text-primary shadow-primary/5",
  };

  const activeTheme = themes[color] || themes.red;

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      className={cn(
        "relative group overflow-hidden rounded-[32px] border bg-zinc-900/40 p-8 backdrop-blur-xl transition-all duration-500 shadow-2xl bg-gradient-to-br",
        activeTheme
      )}
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700" />

      <div className="relative flex items-start justify-between">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 group-hover:text-zinc-300 transition-colors">
            {title}
          </p>
          <div className="space-y-1">
            <h3 className="text-4xl font-black tracking-tighter text-white drop-shadow-md">
              {value}
            </h3>
            {trend && (
              <div className={cn(
                "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest",
                trend.isPositive ? "text-emerald-500" : "text-red-500"
              )}>
                {trend.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {trend.value}
              </div>
            )}
          </div>
        </div>

        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110",
          color === "red" ? "bg-primary/20 border-primary/30 text-primary" :
            color === "green" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-500" :
              color === "blue" ? "bg-blue-500/20 border-blue-500/30 text-blue-400" :
                color === "purple" ? "bg-purple-500/20 border-purple-500/30 text-purple-400" :
                  "bg-orange-500/20 border-orange-500/30 text-orange-400"
        )}>
          <Icon size={28} strokeWidth={1.5} />
        </div>
      </div>
    </motion.div>
  );
}
