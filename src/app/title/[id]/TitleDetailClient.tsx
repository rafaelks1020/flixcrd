"use client";

import { useState } from "react";
import Navbar from "@/components/ui/Navbar";
import TitleDetailHero from "@/components/ui/TitleDetailHero";
import CastCarousel from "@/components/ui/CastCarousel";
import EpisodeList from "@/components/ui/EpisodeList";
import TitleRow from "@/components/ui/TitleRow";
import Toast from "@/components/ui/Toast";
import toast from "react-hot-toast";

interface TitleDetailClientProps {
  title: any;
  genres: Array<{ id: string; name: string }>;
  cast: any[];
  seasons: any[];
  similarTitles: any[];
  isFavorite: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  profileId: string | null;
}

export default function TitleDetailClient({
  title,
  genres,
  cast,
  seasons,
  similarTitles,
  isFavorite: initialIsFavorite,
  isLoggedIn,
  isAdmin,
  profileId,
}: TitleDetailClientProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [loading, setLoading] = useState(false);

  const handleToggleFavorite = async () => {
    if (!profileId) {
      toast.error("Selecione um perfil primeiro");
      return;
    }

    setLoading(true);
    try {
      if (isFavorite) {
        // Remover favorito
        const res = await fetch("/api/user/favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId, titleId: title.id }),
        });

        if (res.ok) {
          setIsFavorite(false);
          toast.success("Removido dos favoritos");
        } else {
          toast.error("Erro ao remover favorito");
        }
      } else {
        // Adicionar favorito
        const res = await fetch("/api/user/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId, titleId: title.id }),
        });

        if (res.ok) {
          setIsFavorite(true);
          toast.success("Adicionado aos favoritos! 🎉");
        } else {
          toast.error("Erro ao adicionar favorito");
        }
      }
    } catch (error) {
      toast.error("Erro ao processar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pt-16">
      <Toast />
      <Navbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {/* Hero */}
      <TitleDetailHero
        title={title}
        genres={genres}
        isFavorite={isFavorite}
        onToggleFavorite={loading ? undefined : handleToggleFavorite}
      />

      {/* Content */}
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 md:px-8">
        {/* Cast */}
        {cast.length > 0 && <CastCarousel cast={cast} />}

        {/* Episodes (for series) */}
        {seasons.length > 0 && (
          <EpisodeList titleId={title.id} seasons={seasons} />
        )}

        {/* Similar Titles */}
        {similarTitles.length > 0 && (
          <TitleRow
            title="Títulos Similares"
            titles={similarTitles}
          />
        )}

        {/* Additional Info */}
        <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
          <h2 className="text-2xl font-bold text-white">Sobre</h2>
          
          <div className="grid gap-4 text-sm md:grid-cols-2">
            {title.originalName && title.originalName !== title.name && (
              <div>
                <span className="text-zinc-400">Título Original:</span>
                <p className="text-white">{title.originalName}</p>
              </div>
            )}
            
            {title.status && (
              <div>
                <span className="text-zinc-400">Status:</span>
                <p className="text-white">{title.status}</p>
              </div>
            )}
            
            {title.releaseDate && (
              <div>
                <span className="text-zinc-400">Lançamento:</span>
                <p className="text-white">
                  {new Date(title.releaseDate).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
            
            {title.voteCount && (
              <div>
                <span className="text-zinc-400">Avaliações:</span>
                <p className="text-white">{title.voteCount.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
