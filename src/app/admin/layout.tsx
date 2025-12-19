"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import GlobalSearch from "@/components/admin/GlobalSearch";
import ShortcutsModal from "@/components/admin/ShortcutsModal";
import { useServiceMonitor } from "@/hooks/useServiceMonitor";
import { useAdminShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  LayoutDashboard,
  BarChart3,
  Activity,
  Film,
  UploadCloud,
  Settings,
  MessageSquare,
  Users,
  CreditCard,
  CheckSquare,
  Bell,
  Zap,
  History,
  Mail,
  FileText,
  Wrench,
  LogOut,
  Home,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Subtitles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NavSection {
  title: string;
  icon: any;
  items: { href: string; label: string; icon: any }[];
}

const navSections: NavSection[] = [
  {
    title: "Visão Geral",
    icon: LayoutDashboard,
    items: [
      { href: "/admin", label: "Dashboard", icon: Home },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/status", label: "System Status", icon: Activity },
    ],
  },
  {
    title: "Intelligence",
    icon: Film,
    items: [
      { href: "/admin/catalog", label: "Catálogo", icon: Film },
      { href: "/admin/upload-v2", label: "Upload Center", icon: UploadCloud },
      { href: "/admin/jobs", label: "HLS Forge", icon: Wrench },
      { href: "/admin/subtitles", label: "Legendas", icon: Subtitles },
      { href: "/admin/solicitacoes", label: "Requests", icon: MessageSquare },
    ],
  },
  {
    title: "Comunidade",
    icon: Users,
    items: [
      { href: "/admin/users", label: "Management", icon: Users },
      { href: "/admin/payments", label: "Billing", icon: CreditCard },
      { href: "/admin/approvals", label: "Kyc / Approvals", icon: CheckSquare },
      { href: "/admin/notifications", label: "Broadcast", icon: Bell },
    ],
  },
  {
    title: "Core System",
    icon: Settings,
    items: [
      { href: "/admin/quick-actions", label: "Quick Actions", icon: Zap },
      { href: "/admin/logs", label: "Runtime Logs", icon: History },
      { href: "/admin/email-logs", label: "Mail Queue", icon: Mail },
      { href: "/admin/changelog", label: "Versions", icon: FileText },
      { href: "/admin/settings", label: "Preferences", icon: Settings },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach((s) => { initial[s.title] = true; });
    return initial;
  });

  useAdminShortcuts();
  useServiceMonitor();

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex min-h-screen bg-black text-zinc-400 selection:bg-primary/30">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#09090b",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "16px",
            fontSize: "13px",
            fontWeight: "bold",
          },
        }}
      />

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 right-6 z-50 flex lg:hidden w-12 h-12 rounded-full bg-primary text-white shadow-2xl items-center justify-center hover:scale-110 active:scale-95 transition-all"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -260 }}
        className="fixed lg:static inset-y-0 left-0 z-50 w-[260px] flex flex-col bg-zinc-950 border-r border-white/5 shadow-2xl backdrop-blur-3xl"
      >
        {/* Sidebar Header */}
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <Sparkles className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-white font-black tracking-tighter text-xl">PFLIX <span className="text-primary italic">ADM</span></h1>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Command Center</p>
            </div>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8 custom-scrollbar">
          {navSections.map((section) => {
            const isOpen = openSections[section.title];
            const SectionIcon = section.icon;

            return (
              <div key={section.title} className="space-y-1">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700 hover:text-zinc-400 transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <SectionIcon size={14} className="group-hover:text-primary transition-colors" />
                    {section.title}
                  </span>
                  <ChevronDown className={cn("transition-transform duration-300", isOpen ? "" : "-rotate-90")} size={14} />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-1"
                    >
                      {section.items.map((item) => {
                        const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                        const ItemIcon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 relative group",
                              active
                                ? "bg-primary text-white font-bold translate-x-1 shadow-lg shadow-primary/10"
                                : "hover:bg-white/5 hover:text-zinc-200"
                            )}
                          >
                            <ItemIcon size={18} className={cn(active ? "text-white" : "text-zinc-500 group-hover:text-primary transition-colors")} />
                            <span className="text-xs">{item.label}</span>
                            {active && (
                              <motion.div
                                layoutId="activeNav"
                                className="absolute left-0 w-1 h-4 bg-white rounded-full"
                              />
                            )}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 space-y-2 border-t border-white/5">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all text-xs font-bold"
          >
            <Home size={18} />
            View Front-end
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-all text-xs font-bold"
          >
            <LogOut size={18} />
            Logout System
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col relative bg-zinc-950">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto relative z-10 flex flex-col custom-scrollbar">
          <div className="flex-1 px-6 md:px-12 py-12">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-[1600px] mx-auto"
            >
              {children}
            </motion.div>
          </div>

          {/* Admin Footer Bar */}
          <footer className="px-12 py-6 border-t border-white/5 bg-black/20 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 flex justify-between items-center">
            <span>Pflix Administrative Terminal v2.4.0</span>
            <div className="flex gap-4">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> System Online</span>
              <span className="text-zinc-800">|</span>
              <span>Secure Connection Est.</span>
            </div>
          </footer>
        </div>
      </main>

      <GlobalSearch />
      <ShortcutsModal />
    </div>
  );
}
