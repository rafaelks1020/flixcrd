"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import GlobalSearch from "@/components/admin/GlobalSearch";
import ShortcutsModal from "@/components/admin/ShortcutsModal";
import { useAdminShortcuts } from "@/hooks/useKeyboardShortcuts";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analytics", label: "📊 Analytics" },
  { href: "/admin/catalog", label: "Catálogo" },
  { href: "/admin/upload-v2", label: "🚀 Upload Unificado" },
  { href: "/admin/jobs", label: "Jobs HLS" },
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/quick-actions", label: "⚡ Ações Rápidas" },
  { href: "/admin/logs", label: "📋 Logs" },
  { href: "/admin/settings", label: "⚙️ Configurações" },
  { href: "/admin/status", label: "Status" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  useAdminShortcuts();

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#18181b",
            color: "#fff",
            border: "1px solid #27272a",
          },
              primary: "#ef4444",
              secondary: "#fafafa",
            },
          },
        }}
      />
      <aside className="flex w-64 flex-col border-r border-zinc-800 px-4 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">PaelFlix Admin</h1>
          <p className="text-xs text-zinc-500">Painel de controle</p>
        </div>
        <nav className="space-y-1 text-sm">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "block rounded-md px-3 py-2 transition-colors " +
                  (active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/"
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
          >
            Ir para PaelFlix
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 px-6 py-6">
        {children}
      </main>
    </div>
  );
}
