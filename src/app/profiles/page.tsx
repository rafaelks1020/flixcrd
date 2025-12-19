"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Settings, Sparkles, User, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  name: string;
  avatar: string | null;
  isKids: boolean;
}

const DEFAULT_AVATARS = ["👤", "😀", "😎", "🤓", "🥳", "🤩", "😇", "🤠", "👨", "👩", "👦", "👧"];

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (err) {
      console.error("Erro ao carregar perfis", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectProfile(profileId: string) {
    localStorage.setItem("activeProfileId", profileId);
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-black text-xs uppercase tracking-[0.2em] animate-pulse">
            Carregando sua experiência...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 relative flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black" />

        {/* Subtle Ambient Glows */}
        <motion.div
          animate={{ opacity: [0.05, 0.1, 0.05], scale: [1, 1.2, 1] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-0 left-0 w-full h-[50vh] bg-primary/5 blur-[120px] rounded-full"
        />
      </div>

      {/* Header / Logo */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-12 left-12 z-20"
      >
        <Link href="/" className="group flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Sparkles size={20} className="text-white fill-white" />
          </div>
          <span className="text-3xl font-black tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
            Pflix
          </span>
        </Link>
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center space-y-16">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl md:text-6xl font-black tracking-tight">
            Quem está assistindo?
          </h1>
          <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-xs">
            Escolha seu perfil para continuar
          </p>
        </motion.header>

        {/* Profiles Grid */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 px-4">
          <AnimatePresence>
            {profiles.map((profile, index) => (
              <motion.button
                key={profile.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleSelectProfile(profile.id)}
                onMouseEnter={() => setHoveredId(profile.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="group relative flex flex-col items-center gap-6"
              >
                {/* Avatar Container */}
                <div className={cn(
                  "relative w-32 h-32 md:w-44 md:h-44 rounded-[28px] overflow-hidden transition-all duration-500 border-4",
                  hoveredId === profile.id
                    ? "border-white scale-110 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                    : "border-transparent bg-zinc-900"
                )}>
                  {/* Glass Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent z-10" />

                  {/* Multi-layered Avatar Background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center">
                    <span className="text-6xl md:text-8xl select-none group-hover:scale-110 transition-transform duration-500">
                      {profile.avatar || DEFAULT_AVATARS[0]}
                    </span>
                  </div>

                  {/* Hover Interaction Element */}
                  <motion.div
                    animate={{ opacity: hoveredId === profile.id ? 1 : 0 }}
                    className="absolute inset-0 bg-black/20 flex items-center justify-center z-20"
                  >
                    <UserCheck className="text-white drop-shadow-lg" size={40} />
                  </motion.div>
                </div>

                {/* Name Label */}
                <div className="space-y-1 text-center">
                  <p className={cn(
                    "text-xl font-black tracking-tight transition-colors duration-300",
                    hoveredId === profile.id ? "text-white" : "text-zinc-500"
                  )}>
                    {profile.name}
                  </p>
                  {profile.isKids && (
                    <span className="inline-block px-3 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                      Kids
                    </span>
                  )}
                </div>
              </motion.button>
            ))}

            {/* Add Profile Feature */}
            {profiles.length < 5 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: profiles.length * 0.1 }}
              >
                <Link
                  href="/profiles/manage"
                  onMouseEnter={() => setHoveredId("add")}
                  onMouseLeave={() => setHoveredId(null)}
                  className="group relative flex flex-col items-center gap-6"
                >
                  <div className={cn(
                    "relative w-32 h-32 md:w-44 md:h-44 rounded-[28px] border-4 border-dashed transition-all duration-500 flex items-center justify-center",
                    hoveredId === "add"
                      ? "border-white bg-zinc-900 scale-110 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                      : "border-zinc-800 hover:border-zinc-700 bg-transparent"
                  )}>
                    <Plus
                      className={cn(
                        "transition-all duration-500",
                        hoveredId === "add" ? "text-white scale-110 rotate-90" : "text-zinc-700"
                      )}
                      size={60}
                      strokeWidth={1.5}
                    />
                  </div>
                  <p className={cn(
                    "text-xl font-black tracking-tight transition-colors duration-300",
                    hoveredId === "add" ? "text-white" : "text-zinc-500"
                  )}>
                    Adicionar
                  </p>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="pt-10"
        >
          <Link
            href="/profiles/manage"
            className="group flex items-center gap-3 px-8 py-3.5 rounded-2xl border border-zinc-700 text-zinc-500 hover:text-white hover:border-white transition-all duration-300 font-black uppercase tracking-[0.2em] text-sm active:scale-95"
          >
            <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            Gerenciar perfis
          </Link>
        </motion.div>
      </div>

      {/* Experimental Shadow */}
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
}
