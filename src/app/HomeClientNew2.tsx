"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PremiumNavbar from "@/components/ui/PremiumNavbar";
import PremiumHero from "@/components/ui/PremiumHero";
import PremiumTitleRow from "@/components/ui/PremiumTitleRow";

interface Genre {
  id: string;
  name: string;
  tmdbId: number;
}

interface Title {
  id: string;
  name: string;
  slug: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  releaseDate: string | null;
  type: string;
}

interface ContinueWatchingItem extends Title {
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
}

interface HomeClientNew2Props {
  isLoggedIn: boolean;
  isAdmin: boolean;
  topTitles: {
    id: string;
    name: string;
    overview: string | null;
    backdropUrl: string | null;
    posterUrl: string | null;
    releaseDate: Date | string | null;
    voteAverage: number | null;
    type: string;
    createdAt: Date | string;
  }[];
  recentTitles: {
    id: string;
    name: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    type: string;
    voteAverage: number | null;
    createdAt: Date | string;
  }[];
}

export default function HomeClientNew2({
  isLoggedIn,
  isAdmin,
  topTitles,
  recentTitles,
}: HomeClientNew2Props) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [titlesByGenre, setTitlesByGenre] = useState<Record<string, Title[]>>({});
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Title[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [heroTitle, setHeroTitle] = useState<typeof topTitles[0] | null>(null);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const router = useRouter();

  function handleProfileNotFound() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("activeProfileId");
    }
    setActiveProfileId(null);
    router.push("/profiles");
  }

  // Aleatorizar hero inicial e configurar autoplay
  useEffect(() => {
    if (topTitles.length === 0) return;

    // Definir título inicial aleatório
    const randomIndex = Math.floor(Math.random() * topTitles.length);
    setCurrentHeroIndex(randomIndex);
    setHeroTitle(topTitles[randomIndex]);

    // Autoplay: trocar de título a cada 8 segundos
    const interval = setInterval(() => {
      setIsTransitioning(true);
      
      setTimeout(() => {
        setCurrentHeroIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % topTitles.length;
          setHeroTitle(topTitles[nextIndex]);
          return nextIndex;
        });
        setIsTransitioning(false);
      }, 300); // Duração da transição
    }, 8000); // Trocar a cada 8 segundos

    return () => clearInterval(interval);
  }, [topTitles]);

  // Carregar perfil ativo
  useEffect(() => {
    if (isLoggedIn && typeof window !== "undefined") {
      const profileId = localStorage.getItem("activeProfileId");
      if (profileId) {
        setActiveProfileId(profileId);
      } else {
        router.push("/profiles");
      }
    }
  }, [isLoggedIn, router]);

  // Carregar dados
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Carregar gêneros
        const genresRes = await fetch("/api/genres");
        const genresJson = await genresRes.json();
        const genresData: Genre[] = Array.isArray(genresJson)
          ? genresJson
          : Array.isArray(genresJson?.data)
            ? genresJson.data
            : [];
        setGenres(genresData.slice(0, 5)); // Primeiros 5 gêneros

        // Carregar títulos por gênero
        const titlePromises = genresData.slice(0, 5).map(async (genre: Genre) => {
          const res = await fetch(`/api/genres/${genre.id}/titles`);
          const json = await res.json();
          const titles = Array.isArray(json)
            ? json
            : Array.isArray(json?.data)
              ? json.data
              : [];
          return { genreId: genre.id, titles };
        });

        const titlesResults = await Promise.all(titlePromises);
        const titlesByGenreMap: Record<string, Title[]> = {};
        titlesResults.forEach(({ genreId, titles }) => {
          titlesByGenreMap[genreId] = titles;
        });
        setTitlesByGenre(titlesByGenreMap);

        // Carregar favoritos e continuar assistindo se logado
        if (isLoggedIn && activeProfileId) {
          try {
            const favRes = await fetch(`/api/user/favorites?profileId=${activeProfileId}`);
            if (favRes.status === 404) {
              handleProfileNotFound();
            } else if (favRes.ok) {
              const favJson = await favRes.json();
              const favData = Array.isArray(favJson)
                ? favJson
                : Array.isArray(favJson?.data)
                  ? favJson.data
                  : [];
              setFavorites(favData);
            }
          } catch (error) {
            console.error("Erro ao carregar favoritos:", error);
          }

          try {
            const cwRes = await fetch(`/api/user/continue-watching?profileId=${activeProfileId}`);
            if (cwRes.status === 404) {
              handleProfileNotFound();
            } else if (cwRes.ok) {
              const cwJson = await cwRes.json();
              const cwData = Array.isArray(cwJson)
                ? cwJson
                : Array.isArray(cwJson?.data)
                  ? cwJson.data
                  : [];
              setContinueWatching(cwData);
            }
          } catch (error) {
            console.error("Erro ao carregar continuar assistindo:", error);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!isLoggedIn || activeProfileId) {
      loadData();
    }
  }, [isLoggedIn, activeProfileId]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000' }}>
      {/* Premium Navbar */}
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {/* Premium Hero com Carrossel */}
      {heroTitle && (
        <div style={{ position: 'relative' }}>
          <div 
            style={{ 
              transition: 'opacity 0.3s ease-in-out',
              opacity: isTransitioning ? 0 : 1,
            }}
          >
            <PremiumHero title={heroTitle} isLoggedIn={isLoggedIn} />
          </div>

          {/* Indicadores de Carrossel */}
          <div style={{
            position: 'absolute',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
            zIndex: 10,
          }}>
            {topTitles.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setCurrentHeroIndex(index);
                    setHeroTitle(topTitles[index]);
                    setIsTransitioning(false);
                  }, 300);
                }}
                style={{
                  width: currentHeroIndex === index ? '32px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: currentHeroIndex === index 
                    ? 'linear-gradient(90deg, #dc2626 0%, #f87171 100%)'
                    : 'rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: currentHeroIndex === index ? '0 0 10px rgba(220, 38, 38, 0.5)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (currentHeroIndex !== index) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentHeroIndex !== index) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                  }
                }}
              />
            ))}
          </div>

          {/* Botões de Navegação */}
          <button
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                const prevIndex = (currentHeroIndex - 1 + topTitles.length) % topTitles.length;
                setCurrentHeroIndex(prevIndex);
                setHeroTitle(topTitles[prevIndex]);
                setIsTransitioning(false);
              }, 300);
            }}
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.8)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
          >
            ‹
          </button>

          <button
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                const nextIndex = (currentHeroIndex + 1) % topTitles.length;
                setCurrentHeroIndex(nextIndex);
                setHeroTitle(topTitles[nextIndex]);
                setIsTransitioning(false);
              }, 300);
            }}
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.8)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {/* Continuar Assistindo */}
        {continueWatching.length > 0 && (
          <div id="continue-watching">
            <PremiumTitleRow title="Continuar Assistindo" titles={continueWatching} />
          </div>
        )}

        {/* Adicionados Recentemente */}
        {recentTitles.length > 0 && (
          <PremiumTitleRow 
            title="🆕 Adicionados Recentemente" 
            titles={recentTitles.map(t => ({
              ...t,
              slug: t.id,
              releaseDate: typeof t.createdAt === 'string' ? t.createdAt : t.createdAt.toISOString(),
            }))}
            showNewBadge
          />
        )}

        {/* Meus Favoritos */}
        {favorites.length > 0 && (
          <PremiumTitleRow title="Meus Favoritos" titles={favorites} />
        )}

        {/* Gêneros */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white text-xl">Carregando...</div>
          </div>
        ) : (
          genres.map((genre) => (
            <PremiumTitleRow
              key={genre.id}
              title={genre.name}
              titles={titlesByGenre[genre.id] || []}
            />
          ))
        )}
      </div>
    </div>
  );
}
