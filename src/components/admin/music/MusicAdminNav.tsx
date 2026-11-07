"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Disc3, LayoutGrid, Mic2, Music, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/music", label: "Painel", icon: LayoutGrid, exact: true },
  { href: "/admin/music/upload", label: "Upload ID3", icon: Upload },
  { href: "/admin/music/artists", label: "Artistas", icon: Mic2 },
  { href: "/admin/music/albums", label: "Álbuns", icon: Disc3 },
  { href: "/admin/music/tracks", label: "Faixas", icon: Music },
];

export function MusicAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/60 p-2 backdrop-blur-md">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all",
              isActive
                ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-500/20"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon size={15} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
