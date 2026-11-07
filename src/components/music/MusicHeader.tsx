"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/music", label: "Início" },
  { href: "/music/search", label: "Buscar" },
  { href: "/music/library", label: "Biblioteca" },
  { href: "/music/playlists", label: "Playlists" },
];

export function MusicHeader() {
  const pathname = usePathname() || "";

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="shrink-0 text-sm font-black tracking-tight text-white">
          Pflix
        </Link>
        <span className="hidden text-zinc-600 sm:inline">/</span>
        <Link href="/music" className="hidden shrink-0 text-sm font-semibold text-fuchsia-300 sm:inline">
          Música
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {LINKS.map((link) => {
            const active = link.href === "/music" ? pathname === "/music" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
                  active ? "bg-fuchsia-500/15 text-fuchsia-200" : "text-zinc-300 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
