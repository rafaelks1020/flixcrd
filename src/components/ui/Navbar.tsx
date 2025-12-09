"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NavbarProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  onSearch?: (query: string) => void;
}

export default function Navbar({ isLoggedIn, isAdmin, onSearch }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/browse?q=${encodeURIComponent(search)}`);
      setShowSearch(false);
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        scrolled
          ? "bg-zinc-950/95 backdrop-blur-md shadow-lg"
          : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
          >
            <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent group-hover:from-red-500 group-hover:to-red-400 transition-all">
              Pflix
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            {isLoggedIn && (
              <>
                <Link
                  href="/"
                  className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  Início
                </Link>
                <Link
                  href="/browse"
                  className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  Catálogo
                </Link>
                <Link
                  href="/solicitacoes"
                  className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  Solicitações
                </Link>
                <Link
                  href="/profiles"
                  className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  Meus Perfis
                </Link>
              </>
            )}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Search */}
            {isLoggedIn && (
              <div className="relative">
                {showSearch ? (
                  <form onSubmit={handleSearchSubmit} className="flex items-center">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar..."
                      autoFocus
                      className="w-48 sm:w-64 rounded-full border border-zinc-700 bg-zinc-900/90 backdrop-blur-sm px-4 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowSearch(false);
                        setSearch("");
                      }}
                      className="ml-2 text-zinc-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowSearch(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                    title="Buscar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Admin Link */}
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:flex items-center gap-1 rounded-full bg-zinc-900/50 px-3 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800/80 hover:text-white transition-colors"
              >
                <span className="text-[12px]">⚙️</span>
                <span>Admin</span>
              </Link>
            )}

            {/* Profile Menu */}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 rounded-full border-2 border-transparent hover:border-zinc-600 p-0.5 transition-all"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center text-white font-semibold text-sm">
                    👤
                  </div>
                </button>

                {showProfileMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 rounded-lg border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-xl z-50">
                      <div className="p-2 space-y-1">
                        <Link
                          href="/profiles"
                          className="block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          Trocar Perfil
                        </Link>
                        <Link
                          href="/settings"
                          className="block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          Configurações
                        </Link>
                        <Link
                          href="/subscribe"
                          className="block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          💳 Minha Assinatura
                        </Link>
                        <hr className="my-1 border-zinc-800" />
                        <Link
                          href="/api/auth/signout"
                          className="block rounded-md px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          Sair
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-gradient-to-r from-red-600 to-red-500 px-6 py-2 text-sm font-semibold text-white hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-900/50"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
