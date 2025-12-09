"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import GlobalSearch from "@/components/admin/GlobalSearch";
import ShortcutsModal from "@/components/admin/ShortcutsModal";
import ThemeToggle from "@/components/admin/ThemeToggle";
import { useServiceMonitor } from "@/hooks/useServiceMonitor";
import { useAdminShortcuts } from "@/hooks/useKeyboardShortcuts";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/approvals", label: "👥 Aprovações" },
  { href: "/admin/analytics", label: "📊 Analytics" },
  { href: "/admin/solicitacoes", label: "📨 Solicitações" },
  { href: "/admin/catalog", label: "Catálogo" },
  { href: "/admin/upload-v2", label: "🚀 Upload Unificado" },
  { href: "/admin/jobs", label: "Jobs HLS" },
  { href: "/admin/subtitles", label: "🎬 Legendas" },
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/notifications", label: "🔔 Notificações" },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useAdminShortcuts();
  
  // Monitoramento de serviço com notificações automáticas
  useServiceMonitor();

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
        }}
      />
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800 lg:hidden"
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 px-4 py-6 space-y-6 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-lg blur opacity-20"></div>
          <div className="relative">
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              Pflix Admin
            </h1>
            <p className="text-xs text-zinc-500">Painel de controle</p>
          </div>
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
                  "group relative block rounded-lg px-3 py-2.5 transition-all duration-200 " +
                  (active
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-900/50"
                    : "text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-50 hover:translate-x-1")
                }
              >
                {active && (
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-lg blur opacity-50 -z-10"></div>
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/"
            className="group relative rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-emerald-500/50 hover:bg-zinc-800 hover:text-zinc-50 transition-all"
          >
            <span className="relative z-10">🏠 Ir para Pflix</span>
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="group relative rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500/50 hover:bg-zinc-800 hover:text-red-400 transition-all"
          >
            <span className="relative z-10">🚫 Sair</span>
          </button>
        </div>
      </aside>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 px-6 py-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 lg:ml-0">
        {children}
      </main>

      <GlobalSearch />
      <ShortcutsModal />
    </div>
  );
}
