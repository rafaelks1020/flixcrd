"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import HeroSection from "@/components/ui/HeroSection";
import TitleRow from "@/components/ui/TitleRow";
import { SkeletonRow } from "@/components/ui/SkeletonCard";
import Toast from "@/components/ui/Toast";
import toast from "react-hot-toast";

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

interface HomeClientProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  heroTitle: {
    id: string;
    name: string;
    overview: string | null;
    backdropUrl: string | null;
    releaseDate: Date | string | null;
    voteAverage: number | null;
  } | null;
}

export default function HomeClientNew({
  isLoggedIn,
  isAdmin,
  heroTitle,
}: HomeClientProps) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [titlesByGenre, setTitlesByGenre] = useState<Record<string, Title[]>>({});
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Title[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const router = useRouter();

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
        // Carregar gêneros
        const genresRes = await fetch("/api/genres");
        const genresData: Genre[] = await genresRes.json();
        setGenres(genresData);

        // Carregar títulos por gênero (primeiros 6 gêneros)
        const genresToLoad = genresData.slice(0, 6);
        const titlesPromises = genresToLoad.map(async (genre) => {
          const res = await fetch(`/api/genres/${genre.id}/titles`);
          const data: Title[] = await res.json();
          return { genreId: genre.id, titles: data };
        });

        const titlesResults = await Promise.all(titlesPromises);
        const titlesMap: Record<string, Title[]> = {};
        for (const result of titlesResults) {
          titlesMap[result.genreId] = result.titles;
        }
        setTitlesByGenre(titlesMap);

        // Carregar favoritos e continuar assistindo (se logado)
        if (isLoggedIn && activeProfileId) {
          const [favRes, cwRes] = await Promise.allSettled([
            fetch(`/api/user/favorites?profileId=${activeProfileId}`),
            fetch(`/api/user/continue-watching?profileId=${activeProfileId}`),
          ]);

          if (favRes.status === "fulfilled" && favRes.value.ok) {
            const favData = await favRes.value.json();
            setFavorites(favData);
          }

          if (cwRes.status === "fulfilled" && cwRes.value.ok) {
            const cwData = await cwRes.value.json();
            setContinueWatching(cwData);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar conteúdo");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isLoggedIn, activeProfileId]);

  const handleAddFavorite = async (titleId: string) => {
    if (!activeProfileId) {
      toast.error("Selecione um perfil primeiro");
      return;
    }

    try {
      const res = await fetch("/api/user/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: activeProfileId, titleId }),
      });

      if (res.ok) {
        toast.success("Adicionado aos favoritos! 🎉");
        // Recarregar favoritos
        const favRes = await fetch(`/api/user/favorites?profileId=${activeProfileId}`);
        if (favRes.ok) {
          const favData = await favRes.json();
          setFavorites(favData);
        }
      } else {
        toast.error("Erro ao adicionar favorito");
      }
    } catch (error) {
      toast.error("Erro ao adicionar favorito");
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Toast />
      
      {/* Navbar */}
      <Navbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {/* Hero Section */}
      <HeroSection title={heroTitle} isLoggedIn={isLoggedIn} />

      {/* Content */}
      <div className="relative z-10 -mt-32 space-y-8 pb-16">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {/* Continuar Assistindo */}
            {continueWatching.length > 0 && (
              <TitleRow
                title="Continuar Assistindo"
                titles={continueWatching.map((item) => ({
                  ...item,
                  progress: item.progressPercent,
                }))}
                onAddFavorite={handleAddFavorite}
              />
            )}

            {/* Favoritos */}
            {favorites.length > 0 && (
              <TitleRow
                title="Meus Favoritos"
                titles={favorites}
                onAddFavorite={handleAddFavorite}
              />
            )}

            {/* Gêneros */}
            {genres.slice(0, 6).map((genre) => {
              const titles = titlesByGenre[genre.id];
              if (!titles || titles.length === 0) return null;
              
              return (
                <TitleRow
                  key={genre.id}
                  title={genre.name}
                  titles={titles}
                  onAddFavorite={handleAddFavorite}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
