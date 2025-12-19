"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "primary";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
  className?: string;
}

export default function Badge({
  children,
  variant = "default",
  size = "md",
  glow = false,
  className
}: BadgeProps) {
  const variantClasses = {
    default: "bg-zinc-800/50 text-zinc-400 border-white/5",
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  const glowClasses = {
    default: "",
    primary: "shadow-[0_0_10px_rgba(229,9,20,0.3)]",
    success: "shadow-[0_0_10px_rgba(16,185,129,0.3)]",
    warning: "shadow-[0_0_10px_rgba(234,179,8,0.3)]",
    error: "shadow-[0_0_10px_rgba(239,68,68,0.3)]",
    info: "shadow-[0_0_10px_rgba(59,130,246,0.3)]",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[9px]",
    md: "px-2.5 py-1 text-[10px]",
    lg: "px-3 py-1.5 text-xs",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border font-black uppercase tracking-[0.1em] transition-all",
        variantClasses[variant],
        sizeClasses[size],
        glow && glowClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
