"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Plus, Check, Info, Star, Clock, Calendar, ChevronLeft, ChevronRight, Youtube } from "lucide-react";
import PremiumNavbar from "@/components/ui/PremiumNavbar";
import PremiumTitleCard from "@/components/ui/PremiumTitleCard";
import FavoriteButton from "./FavoriteButton";
import { cn } from "@/lib/utils";

interface TitleData {
  id: string;
  name: string;
  originalName?: string | null;
  overview?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  releaseDate?: string | Date | null;
  voteAverage?: number | null;
  type?: string | null;
  runtime?: number | null;
  status?: string | null;
}

interface CastMember {
  id: string | number;
  name: string;
  character?: string | null;
  profilePath?: string | null;
}

interface CrewMember {
  id: string | number;
  name: string;
  job?: string | null;
  department?: string | null;
  profilePath?: string | null;
}

interface Episode {
  id: string;
  name: string;
  episodeNumber: number;
  overview?: string;
  stillPath?: string;
  runtime?: number;
}

interface Season {
  id: string;
  seasonNumber: number;
  name?: string;
  episodes?: Episode[];
}

interface SimilarTitle {
  id: string;
  name: string;
  posterUrl?: string | null;
  voteAverage?: number | null;
  type?: string;
  releaseDate?: string;
}

interface Video {
  id: string;
  key: string;
  name: string;
  type: string;
  site: string;
}

interface TitleDetailClientProps {
  title: TitleData;
  genres: string[];
  cast: CastMember[];
  crew: CrewMember[];
  seasons: Season[];
  similarTitles: SimilarTitle[];
  videos: Video[];
  isFavorite: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export default function TitleDetailClient({
  title,
  genres,
  cast,
  crew,
  seasons,
  similarTitles,
  videos,
  isFavorite: initialIsFavorite,
  isLoggedIn,
  isAdmin,
}: TitleDetailClientProps) {
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.seasonNumber || 1);
  const [isScrolled, setIsScrolled] = useState(false);

  const castRowRef = useRef<HTMLDivElement | null>(null);
  const similarRowRef = useRef<HTMLDivElement | null>(null);
  const videosRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollRow = (ref: RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    const container = ref.current;
    if (!container) return;
    const delta = direction === "left" ? -container.offsetWidth * 0.8 : container.offsetWidth * 0.8;
    container.scrollBy({ left: delta, behavior: "smooth" });
  };

  const year = title.releaseDate ? new Date(title.releaseDate).getFullYear() : null;
  const rating = title.voteAverage?.toFixed(1);
  const isSeries = title.type === 'SERIES' || title.type === 'ANIME';

  const currentSeason = seasons.find((s) => s.seasonNumber === selectedSeason);
  const episodes = currentSeason?.episodes || [];

  return (
    <div
      className="min-h-screen bg-black text-white selection:bg-primary/30"
      style={{ "--spotlight-color": "rgba(229, 9, 20, 0.25)" } as any}
    >
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      {/* Hero Section */}
      <section className="relative w-full h-[85vh] md:h-[95vh] min-h-[600px] overflow-hidden group">
        {/* Backdrop Background */}
        <AnimatePresence mode="wait">
          <motion.div
            key={title.backdropUrl}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
          >
            {title.backdropUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[20s] ease-linear group-hover:scale-110"
                style={{ backgroundImage: `url(${title.backdropUrl})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-zinc-900" />
            )}

            {/* Cinematic Gradients */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
          </motion.div>
        </AnimatePresence>

        {/* Hero Content */}
        <div className="relative z-10 flex h-full items-end px-4 md:px-16 pt-32 md:pt-40 pb-16 md:pb-24 max-w-[1400px] mx-auto">
          <div className="w-full lg:max-w-4xl">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="space-y-6"
            >
              {/* Title */}
              <div>
                <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-tight mb-2 drop-shadow-2xl">
                  {title.name}
                </h1>
                {title.originalName && title.originalName !== title.name && (
                  <p className="text-lg md:text-xl text-zinc-400 font-medium tracking-tight opacity-70 italic">
                    {title.originalName}
                  </p>
                )}
              </div>

              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-4 text-sm md:text-base font-bold text-zinc-300 drop-shadow-md">
                {rating && (
                  <div className="flex items-center gap-1.5 text-green-500 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
                    <Star size={16} fill="currentColor" />
                    <span>{rating}</span>
                  </div>
                )}
                {year && (
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
                    <Calendar size={16} />
                    <span>{year}</span>
                  </div>
                )}
                {title.runtime && (
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
                    <Clock size={16} />
                    <span>{Math.floor(title.runtime / 60)}h {title.runtime % 60}m</span>
                  </div>
                )}
                <span className="uppercase tracking-widest text-primary font-black px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                  {title.type === 'MOVIE' ? 'Filme' : title.type === 'SERIES' ? 'Série' : title.type}
                </span>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2">
                {genres.map((genre, i) => (
                  <span key={i} className="bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-xs md:text-sm font-bold transition-colors cursor-default">
                    {genre}
                  </span>
                ))}
              </div>

              {/* Overview */}
              <p className="text-lg text-zinc-300/90 leading-relaxed max-w-2xl drop-shadow-md font-medium line-clamp-3 md:line-clamp-none">
                {title.overview}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link
                  href={isSeries && episodes[0] ? `/watch/${title.id}?episodeId=${episodes[0].id}` : `/watch/${title.id}`}
                  className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-black text-lg hover:bg-zinc-200 transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                >
                  <Play size={24} fill="currentColor" />
                  Assistir Agora
                </Link>

                <FavoriteButton titleId={title.id} initialIsFavorite={initialIsFavorite} />

                <button className="flex items-center justify-center w-[58px] h-[58px] rounded-xl bg-black/40 border-2 border-zinc-500/50 text-white hover:border-white hover:bg-black/60 transition-all transform hover:scale-105 active:scale-95 shadow-xl backdrop-blur-md">
                  <Info size={28} />
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content Space Container */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-16 -mt-10 relative z-20 pb-40 space-y-24">

        {/* Episodes Section */}
        {isSeries && seasons.length > 0 && (
          <motion.section
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 bg-primary rounded-full" />
                <h2 className="text-3xl font-black tracking-tight underline-offset-8 decoration-primary/40 decoration-4">Episódios</h2>
              </div>

              <div className="relative min-w-[200px]">
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  className="w-full bg-zinc-900/80 border border-white/10 rounded-xl py-3 px-5 text-sm font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer backdrop-blur-lg hover:bg-zinc-800"
                >
                  {seasons.map((s) => (
                    <option key={s.seasonNumber} value={s.seasonNumber}>Temporada {s.seasonNumber}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  {/* Custom arrow icon here if needed */}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {episodes.map((ep, idx) => (
                <Link
                  key={ep.id}
                  href={`/watch/${title.id}?episodeId=${ep.id}`}
                  className="group flex flex-col md:flex-row gap-6 bg-zinc-900/30 hover:bg-zinc-900/80 border border-white/5 p-4 rounded-2xl transition-all duration-300 hover:shadow-2xl hover:border-white/10"
                >
                  <div className="relative w-full md:w-72 flex-shrink-0 aspect-video rounded-xl overflow-hidden shadow-lg border border-white/5">
                    {ep.stillPath ? (
                      <img src={ep.stillPath} alt={ep.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 text-4xl">🎬</div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
                        <Play size={24} fill="currentColor" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black border border-white/10">
                      EP {ep.episodeNumber}
                    </div>
                  </div>

                  <div className="flex flex-col justify-center flex-1 space-y-3 py-2">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-xl font-black tracking-tight group-hover:text-primary transition-colors">
                        {ep.episodeNumber}. {ep.name}
                      </h3>
                      {ep.runtime && (
                        <span className="text-sm font-bold text-zinc-500 flex items-center gap-1.5 whitespace-nowrap">
                          <Clock size={14} />
                          {ep.runtime} min
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2 md:line-clamp-none font-medium">
                      {ep.overview || "Nenhuma descrição disponível para este episódio."}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        {/* Similar Titles Grid */}
        {similarTitles.length > 0 && (
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 bg-primary rounded-full" />
                <h2 className="text-3xl font-black tracking-tight">Títulos Semelhantes</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => scrollRow(similarRowRef, 'left')} className="p-2 rounded-full border border-white/10 bg-zinc-900/50 hover:bg-zinc-800 transition-colors">
                  <ChevronLeft size={24} />
                </button>
                <button onClick={() => scrollRow(similarRowRef, 'right')} className="p-2 rounded-full border border-white/10 bg-zinc-900/50 hover:bg-zinc-800 transition-colors">
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            <div
              ref={similarRowRef}
              className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide pb-4 snap-x"
            >
              {similarTitles.map((item) => (
                <div key={item.id} className="w-36 md:w-56 flex-shrink-0 snap-start">
                  <PremiumTitleCard
                    id={item.id}
                    name={item.name}
                    posterUrl={item.posterUrl || null}
                    type={item.type || 'MOVIE'}
                    rating={item.voteAverage || undefined}
                    year={item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cast Section */}
        {cast.length > 0 && (
          <section className="space-y-10">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-primary rounded-full" />
              <h2 className="text-3xl font-black tracking-tight">Principais Atores</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8">
              {cast.slice(0, 12).map((person) => (
                <div key={person.id} className="group flex flex-col items-center text-center space-y-4">
                  <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-white/5 transition-all duration-500 group-hover:border-primary group-hover:shadow-[0_0_20px_rgba(229,9,20,0.3)] transform group-hover:scale-105">
                    {person.profilePath ? (
                      <img src={person.profilePath} alt={person.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-4xl text-zinc-700">👤</div>
                    )}
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div>
                    <p className="font-black tracking-tight text-white group-hover:text-primary transition-colors">{person.name}</p>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1 line-clamp-1">{person.character}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Videos Section */}
        {videos.some(v => v.site === 'YouTube') && (
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-primary rounded-full" />
              <h2 className="text-3xl font-black tracking-tight">Trailers e Vídeos</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {videos.filter(v => v.site === 'YouTube').slice(0, 6).map((video) => (
                <div key={video.id} className="group bg-zinc-900/40 rounded-3xl overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-300 hover:shadow-2xl">
                  <div className="aspect-video relative">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.key}?rel=0&modestbranding=1&textcolor=white`}
                      title={video.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Youtube size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{video.type}</span>
                    </div>
                    <h4 className="font-black tracking-tight text-zinc-100 group-hover:text-white transition-colors line-clamp-1">
                      {video.name}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
