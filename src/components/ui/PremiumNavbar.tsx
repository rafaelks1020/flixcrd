"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Search, Bell, Menu, X, ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumNavbarProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export default function PremiumNavbar({ isLoggedIn, isAdmin }: PremiumNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { scrollY } = useScroll();
  const pathname = usePathname();
  const router = useRouter();

  const showLab = isAdmin || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";
  const isLabRoute = pathname?.startsWith("/lab");

  useMotionValueEvent(scrollY, "change", (latest) => {
    const current = latest;
    setIsScrolled(current > 50);

    // Smart hide/show logic (Cinema Mode)
    if (current > lastScrollY && current > 100) {
      setIsVisible(false); // Hide on scroll down
    } else {
      setIsVisible(true);  // Show on scroll up
    }
    setLastScrollY(current);
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const target = isLabRoute ? "/lab/explore" : "/browse";
      router.push(`${target}?q=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
      setSearchQuery("");
      setMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { href: '/', label: 'Início' },
    { href: '/browse', label: 'Catálogo' },
    { href: '/solicitacoes', label: 'Solicitações' },
    { href: '/profiles', label: 'Perfis' },
    ...(showLab ? [{ href: '/lab', label: 'Lab' }] : []),
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{
        y: isVisible ? 0 : -100,
        backgroundColor: isScrolled ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0)",
        backdropFilter: isScrolled ? "blur(12px)" : "blur(0px)",
      }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 md:px-12 h-16 md:h-20 flex items-center justify-between transition-colors duration-500",
        isScrolled && "border-b border-white/5"
      )}
    >
      {/* Left Section: Logo & Nav */}
      <div className="flex items-center gap-8 md:gap-12">
        <div className="flex items-center gap-4">
          {isLoggedIn && (
            <button
              className="md:hidden text-white/90 hover:text-white"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
          )}

          <Link href="/" className="relative group">
            <span className="text-2xl md:text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-primary to-red-600 group-hover:to-red-500 transition-all duration-300">
              Pflix
            </span>
            <div className="absolute -inset-2 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Link>
        </div>

        {isLoggedIn && (
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-all duration-300 hover:text-white relative group py-2",
                  pathname === link.href ? "text-white" : "text-white/60"
                )}
              >
                {link.label}
                {pathname === link.href && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_var(--primary)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-4 md:gap-6">
        {isLoggedIn ? (
          <>
            {/* Search Button with Shortcut Hint */}
            <button
              onClick={() => {
                // Dispatch event to open SpotlightSearch if needed, 
                // but since SpotlightSearch listens to Cmd+K, we can just 
                // trigger the same event or use a custom one.
                // For simplicity, I'll rely on the user testing the Cmd+K shortcut
                // but providing a clear visual cue.
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/10"
            >
              <Search size={18} />
              <span className="text-xs font-bold uppercase tracking-widest px-1">Buscar</span>
              <kbd className="flex h-5 items-center gap-1 rounded border border-white/20 bg-black/40 px-1.5 font-mono text-[10px] font-medium text-white/40">
                ⌘K
              </kbd>
            </button>

            {/* Admin Badge */}
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden md:flex items-center px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all border border-white/5 hover:border-white/20"
              >
                ADMIN
              </Link>
            )}

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 group"
              >
                <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-red-900 flex items-center justify-center text-xs font-bold shadow-lg shadow-black/50 group-hover:scale-105 transition-transform duration-300 border border-white/10">
                  <User size={16} />
                </div>
                <ChevronDown
                  size={14}
                  className={cn("text-white/60 transition-transform duration-300", profileMenuOpen && "rotate-180")}
                />
              </button>

              <AnimatePresence>
                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 top-full mt-4 w-56 p-2 rounded-xl bg-black/90 border border-white/10 shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
                    >
                      <div className="flex flex-col gap-1">
                        {[
                          { href: '/profiles', label: 'Trocar Perfil' },
                          { href: '/settings', label: 'Configurações' },
                          { href: '/subscribe', label: 'Minha Assinatura' },
                          { href: '/payments', label: 'Pagamentos' },
                        ].map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setProfileMenuOpen(false)}
                            className="px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          >
                            {item.label}
                          </Link>
                        ))}
                        <div className="h-px bg-white/10 my-1" />
                        <Link
                          href="/api/auth/signout"
                          onClick={() => setProfileMenuOpen(false)}
                          className="px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors font-medium"
                        >
                          Sair
                        </Link>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <Link
            href="/login"
            className="px-5 py-2 rounded-lg bg-primary hover:bg-red-700 text-white text-sm font-bold shadow-[0_0_20px_rgba(229,9,20,0.4)] hover:shadow-[0_0_30px_rgba(229,9,20,0.6)] transition-all duration-300 transform hover:scale-105"
          >
            Entrar
          </Link>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-3/4 max-w-sm bg-zinc-950 z-[100] border-r border-white/10 p-6 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="text-2xl font-black text-primary">Pflix</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-white/60 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSearch} className="relative mb-8">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
                  placeholder="Buscar..."
                />
              </form>

              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 text-lg font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="h-px bg-white/10 my-4" />

                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-lg text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                  Configurações
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 text-lg text-primary hover:bg-primary/10 rounded-xl transition-colors font-bold"
                  >
                    Painel Admin
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
