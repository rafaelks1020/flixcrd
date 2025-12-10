"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import GlobalSearch from "@/components/admin/GlobalSearch";
import ShortcutsModal from "@/components/admin/ShortcutsModal";
import { useServiceMonitor } from "@/hooks/useServiceMonitor";
import { useAdminShortcuts } from "@/hooks/useKeyboardShortcuts";

// Ícones SVG inline para evitar dependência externa
const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

interface NavSection {
  title: string;
  icon: string;
  items: { href: string; label: string; icon: string }[];
}

const navSections: NavSection[] = [
  {
    title: "Visão Geral",
    icon: "📊",
    items: [
      { href: "/admin", label: "Dashboard", icon: "🏠" },
      { href: "/admin/analytics", label: "Analytics", icon: "📈" },
      { href: "/admin/status", label: "Status", icon: "🟢" },
    ],
  },
  {
    title: "Conteúdo",
    icon: "📺",
    items: [
      { href: "/admin/catalog", label: "Catálogo", icon: "🎬" },
      { href: "/admin/upload-v2", label: "Upload", icon: "🚀" },
      { href: "/admin/jobs", label: "Jobs HLS", icon: "⚙️" },
      { href: "/admin/subtitles", label: "Legendas", icon: "💬" },
      { href: "/admin/solicitacoes", label: "Solicitações", icon: "📨" },
    ],
  },
  {
    title: "Usuários",
    icon: "👥",
    items: [
      { href: "/admin/users", label: "Gerenciar", icon: "👤" },
      { href: "/admin/approvals", label: "Aprovações", icon: "✅" },
      { href: "/admin/notifications", label: "Notificações", icon: "🔔" },
    ],
  },
  {
    title: "Sistema",
    icon: "⚙️",
    items: [
      { href: "/admin/quick-actions", label: "Ações Rápidas", icon: "⚡" },
      { href: "/admin/logs", label: "Logs", icon: "📋" },
      { href: "/admin/changelog", label: "Changelog", icon: "📝" },
      { href: "/admin/settings", label: "Configurações", icon: "🔧" },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Estado para controlar seções abertas (todas abertas por padrão)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach((s) => {
      initial[s.title] = true;
    });
    return initial;
  });

  useAdminShortcuts();
  
  // Monitoramento de serviço com notificações automáticas
  useServiceMonitor();

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

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
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 px-3 py-5 space-y-4 transition-transform duration-300 overflow-y-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="relative px-1">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-lg blur opacity-20"></div>
          <div className="relative">
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              Pflix Admin
            </h1>
            <p className="text-xs text-zinc-500">Painel de controle</p>
          </div>
        </div>

        {/* Navegação com seções colapsáveis */}
        <nav className="flex-1 space-y-2 text-sm">
          {navSections.map((section) => {
            const isOpen = openSections[section.title];
            const hasActiveItem = section.items.some(
              (item) =>
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href))
            );

            return (
              <div key={section.title}>
                {/* Cabeçalho da seção */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                    hasActiveItem
                      ? "text-emerald-400 bg-emerald-950/30"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{section.icon}</span>
                    <span>{section.title}</span>
                  </span>
                  <ChevronDown open={isOpen} />
                </button>

                {/* Itens da seção */}
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="mt-1 ml-2 space-y-0.5 border-l border-zinc-800 pl-2">
                    {section.items.map((item) => {
                      const active =
                        pathname === item.href ||
                        (item.href !== "/admin" && pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-all duration-150 ${
                            active
                              ? "bg-emerald-600 text-white font-medium shadow-md shadow-emerald-900/40"
                              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                          }`}
                        >
                          <span className="text-sm">{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
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
