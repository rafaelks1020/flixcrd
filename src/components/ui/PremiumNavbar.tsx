"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Search, Bell, Menu, X, ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumNavbarProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

// Portal component to render mobile menu at document body level
function MobileMenuPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{
          y: isVisible ? 0 : -100,
          backgroundColor: isScrolled ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0)",
          backdropFilter: isScrolled ? "blur(12px)" : "blur(0px)",
        }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] px-4 md:px-12 h-16 md:h-20 flex items-center justify-between transition-colors duration-500",
          isScrolled && "border-b border-white/5"
        )}
      >
        {/* Left Section: Logo & Nav */}
        <div className="flex items-center gap-8 md:gap-12">
          <div className="flex items-center gap-4">
            {isLoggedIn && (
              <button
                className="md:hidden text-white/90 hover:text-white p-2 -ml-2"
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
      </motion.nav>

      {/* Mobile Menu - Using Portal to render at document.body level */}
      <MobileMenuPortal>
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.95)',
                  zIndex: 99999,
                  backdropFilter: 'blur(8px)',
                }}
                onClick={() => setMobileMenuOpen(false)}
              />

              {/* Menu Panel */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: '85vw',
                  maxWidth: '320px',
                  backgroundColor: '#0a0a0a',
                  zIndex: 100000,
                  borderRight: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 0 60px rgba(0,0,0,0.8)',
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '24px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: '#e50914' }}>Pflix</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.6)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} style={{ padding: '16px 24px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'rgba(255,255,255,0.4)',
                      width: '20px',
                      height: '20px',
                    }} />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '12px 16px 12px 44px',
                        color: 'white',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                      placeholder="Buscar títulos..."
                    />
                  </div>
                </form>

                {/* Navigation Links */}
                <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {navLinks.map((link) => {
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          style={{
                            padding: '14px 16px',
                            fontSize: '16px',
                            fontWeight: 500,
                            borderRadius: '12px',
                            color: isActive ? '#e50914' : 'rgba(255,255,255,0.7)',
                            backgroundColor: isActive ? 'rgba(229,9,20,0.15)' : 'transparent',
                            textDecoration: 'none',
                            display: 'block',
                          }}
                        >
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Link
                      href="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        padding: '14px 16px',
                        fontSize: '16px',
                        color: 'rgba(255,255,255,0.6)',
                        textDecoration: 'none',
                        borderRadius: '12px',
                      }}
                    >
                      Configurações
                    </Link>
                    <Link
                      href="/subscribe"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        padding: '14px 16px',
                        fontSize: '16px',
                        color: 'rgba(255,255,255,0.6)',
                        textDecoration: 'none',
                        borderRadius: '12px',
                      }}
                    >
                      Minha Assinatura
                    </Link>
                  </div>

                  {isAdmin && (
                    <>
                      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />
                      <Link
                        href="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '14px 16px',
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#e50914',
                          backgroundColor: 'rgba(229,9,20,0.1)',
                          textDecoration: 'none',
                          borderRadius: '12px',
                        }}
                      >
                        <span>⚡</span>
                        Painel Admin
                      </Link>
                    </>
                  )}
                </nav>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Link
                    href="/api/auth/signout"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '14px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#f87171',
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      textDecoration: 'none',
                      borderRadius: '12px',
                    }}
                  >
                    Sair da conta
                  </Link>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </MobileMenuPortal>
    </>
  );
}
