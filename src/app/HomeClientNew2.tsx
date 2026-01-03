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

  async function handleClearContinueWatching() {
    if (!activeProfileId) return;

    if (!confirm("Tem certeza que deseja limpar todo o seu histórico de 'Continuar Assistindo'?")) {
      return;
    }

    try {
      const res = await fetch(`/api/user/continue-watching?profileId=${activeProfileId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setContinueWatching([]);
      } else {
        alert("Erro ao limpar histórico.");
      }
    } catch (error) {
      console.error("Erro ao limpar histórico:", error);
      alert("Erro ao limpar histórico.");
    }
  }

  async function handleRemoveContinueWatching(titleId: string) {
    if (!activeProfileId) return;

    try {
      const res = await fetch(`/api/user/continue-watching?profileId=${activeProfileId}&titleId=${titleId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setContinueWatching(prev => prev.filter(t => t.id !== titleId));
      } else {
        console.error("Erro ao remover título do histórico.");
      }
    } catch (error) {
      console.error("Erro ao remover título do histórico:", error);
    }
  }


  return (
    <div
      className="min-h-screen bg-black text-white selection:bg-red-500/30"
      style={{ "--spotlight-color": "rgba(229, 9, 20, 0.15)" } as any}
    >
      {/* Premium Navbar */}
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {/* Premium Hero com Carrossel */}
      {heroTitle && (
        <div className="relative group/hero">
          <div
            className={`transition-opacity duration-700 ease-in-out ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
          >
            <PremiumHero title={heroTitle} isLoggedIn={isLoggedIn} />
          </div>

          {/* Indicadores de Carrossel */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
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
                className={`h-1.5 rounded-full transition-all duration-300 ${currentHeroIndex === index
                  ? 'w-8 bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_10px_rgba(220,38,38,0.5)]'
                  : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
              />
            ))}
          </div>

          {/* Botões de Navegação (Only visible on hover) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-4 md:px-8">
            <button
              className="pointer-events-auto w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-black/50 hover:border-white/30 hover:scale-110 active:scale-95"
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  const prevIndex = (currentHeroIndex - 1 + topTitles.length) % topTitles.length;
                  setCurrentHeroIndex(prevIndex);
                  setHeroTitle(topTitles[prevIndex]);
                  setIsTransitioning(false);
                }, 300);
              }}
            >
              ‹
            </button>
            <button
              className="pointer-events-auto w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-black/50 hover:border-white/30 hover:scale-110 active:scale-95"
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  const nextIndex = (currentHeroIndex + 1) % topTitles.length;
                  setCurrentHeroIndex(nextIndex);
                  setHeroTitle(topTitles[nextIndex]);
                  setIsTransitioning(false);
                }, 300);
              }}
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 -mt-20 pb-20 space-y-8 md:space-y-12 bg-gradient-to-b from-transparent via-black to-black">
        {/* Continuar Assistindo */}
        {continueWatching.length > 0 && (
          <div id="continue-watching">
            <div className="flex items-center justify-between px-4 md:px-12 -mb-8">
              <PremiumTitleRow
                title="Continuar Assistindo"
                titles={continueWatching}
                onDelete={handleRemoveContinueWatching}
              />
              <button
                onClick={handleClearContinueWatching}
                className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-colors bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:border-red-500/20"
              >
                Limpar Histórico
              </button>
            </div>
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
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-500 animate-pulse">Carregando catálogo...</p>
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
