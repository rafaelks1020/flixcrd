"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import PremiumNavbar from "@/components/ui/PremiumNavbar";

interface Title {
  id: string;
  name: string;
  posterUrl: string | null;
  backdropUrl?: string | null;
  type: string;
  voteAverage?: number | null;
  releaseDate?: string | null;
}

interface BrowseClientProps {
  initialTitles: Title[];
  isLoggedIn: boolean;
  isAdmin: boolean;
}

const PAGE_SIZE = 48;

export default function BrowseClient({
  initialTitles,
  isLoggedIn,
  isAdmin,
}: BrowseClientProps) {
  const [titles, setTitles] = useState<Title[]>(initialTitles);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("popularity");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const loadTitles = useCallback(async (pageToLoad: number, reset: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.append("type", filterType);
      if (sortBy) params.append("sort", sortBy);
      if (searchQuery) params.append("q", searchQuery);
      params.append("page", String(pageToLoad));
      params.append("limit", String(PAGE_SIZE));

      const res = await fetch(`/api/titles?${params.toString()}`);
      if (!res.ok) return;

      const json = await res.json();
      const list: Title[] = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
          ? json.data
          : [];

      setTitles((prev) => (reset ? list : [...prev, ...list]));
      setPage(pageToLoad);
      setHasMore(list.length === PAGE_SIZE);
    } catch (error) {
      console.error("Erro ao carregar títulos:", error);
    } finally {
      setLoading(false);
    }
  }, [filterType, sortBy, searchQuery]);

  // Carrega a primeira página sempre que filtros/ordenação/busca mudarem
  useEffect(() => {
    loadTitles(1, true);
  }, [loadTitles]);

  // Observer para infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const node = observerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadTitles(page + 1, false);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, page, loadTitles]);

  const selectStyle: React.CSSProperties = {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '4px',
    padding: '10px 16px',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '100px 4% 60px' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, marginBottom: '24px' }}>
            Catálogo
          </h1>

          {/* Search */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ position: 'relative', maxWidth: '500px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar títulos..."
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  paddingLeft: '50px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '15px',
                  outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#e50914'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#333'}
              />
              <svg
                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: 'rgba(255,255,255,0.5)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={selectStyle}
            >
              <option value="ALL">Todos os Tipos</option>
              <option value="MOVIE">Filmes</option>
              <option value="SERIES">Séries</option>
              <option value="ANIME">Animes</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={selectStyle}
            >
              <option value="popularity">Mais Populares</option>
              <option value="recent">Mais Recentes</option>
              <option value="rating">Melhor Avaliados</option>
              <option value="name">Nome (A-Z)</option>
            </select>

            <span style={{ marginLeft: 'auto', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
              {titles.length} título{titles.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
            {[...Array(18)].map((_, i) => (
              <div key={i} style={{ aspectRatio: '2/3', background: '#1a1a1a', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
            ))}
          </div>
        ) : titles.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
            {titles.map((title) => (
              <Link
                key={title.id}
                href={`/title/${title.id}`}
                onMouseEnter={() => setHoveredId(title.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'block',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  background: '#141414',
                  textDecoration: 'none',
                  color: '#fff',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  transform: hoveredId === title.id ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: hoveredId === title.id ? '0 10px 30px rgba(0,0,0,0.5)' : 'none',
                }}
              >
                <div style={{ position: 'relative' }}>
                  {title.posterUrl ? (
                    <img src={title.posterUrl} alt={title.name} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '2/3', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>🎬</div>
                  )}
                  
                  {/* Rating Badge */}
                  {title.voteAverage && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      <span style={{ color: '#ffd700' }}>★</span>
                      <span>{title.voteAverage.toFixed(1)}</span>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  {hoveredId === title.id && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)' }}>
                      <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{title.name}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                        {title.releaseDate && <span>{new Date(title.releaseDate).getFullYear()}</span>}
                        <span style={{ textTransform: 'uppercase' }}>{title.type === 'MOVIE' ? 'Filme' : title.type === 'SERIES' ? 'Série' : title.type}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }}>🎬</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Nenhum título encontrado</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Tente ajustar os filtros ou fazer uma nova busca</p>
          </div>
        )}

        {/* Infinite scroll trigger */}
        {hasMore && !loading && (
          <div ref={observerRef} style={{ height: 1 }} />
        )}
      </div>
    </div>
  );
}
