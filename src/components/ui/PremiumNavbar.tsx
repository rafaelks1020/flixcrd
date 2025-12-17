"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface PremiumNavbarProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export default function PremiumNavbar({ isLoggedIn, isAdmin }: PremiumNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const showLab = isAdmin || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";
  const isLabRoute = Boolean(pathname && pathname.startsWith("/lab"));
  const hideSearch = false;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(max-width: 768px)");

    const update = () => {
      const mobile = Boolean(mq.matches);
      setIsMobile(mobile);
      if (!mobile) {
        setMobileMenuOpen(false);
      }
    };

    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const target = isLabRoute ? "/lab/explore" : "/browse";
      router.push(`${target}?q=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: isMobile ? '0 16px' : '0 4%',
        height: isMobile ? '56px' : '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: scrolled 
          ? 'rgba(0, 0, 0, 0.95)' 
          : 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Left Section: Logo + Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '14px' : '40px' }}>
        {isLoggedIn && isMobile && (
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((prev) => !prev);
              setSearchOpen(false);
              setProfileMenuOpen(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              marginLeft: '-8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
            aria-label="Abrir menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span
            style={{
              fontSize: isMobile ? '22px' : '28px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #e50914 0%, #b81d24 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-1px',
            }}
          >
            Pflix
          </span>
        </Link>

        {/* Navigation Links */}
        {isLoggedIn && !isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {[
              { href: '/', label: 'Início' },
              { href: '/browse', label: 'Catálogo' },
              { href: '/solicitacoes', label: 'Solicitações' },
              { href: '/profiles', label: 'Perfis' },
              ...(showLab ? [{ href: '/lab', label: 'Lab' }] : []),
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'color 0.2s ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Right Section: Search + Admin + Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '20px' }}>
        {/* Search */}
        {isLoggedIn && !hideSearch && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {searchOpen && !isMobile ? (
              <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Títulos, pessoas, gêneros"
                  autoFocus
                  style={{
                    width: '260px',
                    padding: '8px 16px',
                    paddingLeft: '40px',
                    background: 'rgba(0,0,0,0.75)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#fff'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
                />
                <svg
                  style={{
                    position: 'absolute',
                    left: '12px',
                    width: '18px',
                    height: '18px',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <button
                  type="button"
                  onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                  style={{
                    marginLeft: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '18px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </form>
            ) : (
              <button
                onClick={() => {
                  if (isMobile) {
                    setMobileMenuOpen((prev) => !prev);
                    setProfileMenuOpen(false);
                    setSearchOpen(false);
                    return;
                  }
                  setSearchOpen(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  style={{ width: '22px', height: '22px', color: '#fff' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Admin Badge */}
        {isAdmin && !isMobile && (
          <Link
            href="/admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'background 0.2s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Admin
          </Link>
        )}

        {/* Profile */}
        {isLoggedIn ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '4px',
                  background: 'linear-gradient(135deg, #e50914 0%, #b81d24 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                }}
              >
                👤
              </div>
              <svg
                style={{
                  width: '12px',
                  height: '12px',
                  color: '#fff',
                  transform: profileMenuOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s ease',
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {profileMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setProfileMenuOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '180px',
                    background: 'rgba(0,0,0,0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '4px',
                    padding: '8px 0',
                    zIndex: 50,
                  }}
                >
                  {[
                    { href: '/profiles', label: 'Trocar Perfil' },
                    { href: '/settings', label: 'Configurações' },
                    { href: '/subscribe', label: '💳 Minha Assinatura' },
                    { href: '/payments', label: '🧾 Pagamentos' },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setProfileMenuOpen(false)}
                      style={{
                        display: 'block',
                        padding: '10px 16px',
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: '13px',
                        textDecoration: 'none',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
                  <Link
                    href="/api/auth/signout"
                    onClick={() => setProfileMenuOpen(false)}
                    style={{
                      display: 'block',
                      padding: '10px 16px',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '13px',
                      textDecoration: 'none',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Sair
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            style={{
              padding: '8px 20px',
              background: '#e50914',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background 0.2s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f40612'}
            onMouseOut={(e) => e.currentTarget.style.background = '#e50914'}
          >
            Entrar
          </Link>
        )}
      </div>

      {isLoggedIn && isMobile && mobileMenuOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              top: '56px',
              bottom: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 900,
            }}
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              top: '56px',
              background: 'rgba(0,0,0,0.97)',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              padding: '14px 16px 18px',
              zIndex: 901,
            }}
          >
            <form
              onSubmit={(e) => {
                handleSearch(e);
                setMobileMenuOpen(false);
              }}
              style={{ position: 'relative', marginBottom: '14px' }}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  paddingLeft: '40px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '15px',
                  outline: 'none',
                }}
              />
              <svg
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '18px',
                  height: '18px',
                  color: 'rgba(255,255,255,0.7)',
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { href: '/', label: 'Início' },
                { href: '/browse', label: 'Catálogo' },
                { href: '/solicitacoes', label: 'Solicitações' },
                { href: '/profiles', label: 'Perfis' },
                ...(showLab ? [{ href: '/lab', label: 'Lab' }] : []),
                { href: '/subscribe', label: 'Minha Assinatura' },
                { href: '/payments', label: 'Pagamentos' },
                { href: '/settings', label: 'Configurações' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '15px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  style={{
                    color: 'rgba(255,255,255,0.95)',
                    fontSize: '15px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(229, 9, 20, 0.14)',
                    border: '1px solid rgba(229, 9, 20, 0.35)',
                  }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
