"use client";

import { useTheme } from "@/hooks/useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="group relative rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-emerald-500/50 hover:bg-zinc-800 hover:text-zinc-50 transition-all"
      title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
    >
      <span className="relative z-10 flex items-center gap-2">
        {theme === "dark" ? "🌙" : "☀️"}
        <span className="hidden sm:inline">
          {theme === "dark" ? "Escuro" : "Claro"}
        </span>
      </span>
    </button>
  );
}
