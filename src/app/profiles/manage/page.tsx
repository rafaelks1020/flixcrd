"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Settings, X, Trash2, Edit3, Check, Sparkles, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  name: string;
  avatar: string | null;
  isKids: boolean;
  useCloudflareProxy?: boolean;
}

const DEFAULT_AVATARS = [
  "👤", "😀", "😎", "🤓", "🥳", "🤩", "😇", "🤠",
  "👨", "👩", "👦", "👧", "🧑", "👶", "🐶", "🐱",
];

export default function ManageProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    avatar: "👤",
    isKids: false,
    useCloudflareProxy: false,
  });

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

  function openCreateModal() {
    setEditingId(null);
    setForm({ name: "", avatar: "👤", isKids: false, useCloudflareProxy: false });
    setError(null);
    setShowModal(true);
  }

  function openEditModal(profile: Profile) {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      avatar: profile.avatar || "👤",
      isKids: profile.isKids,
      useCloudflareProxy: Boolean(profile.useCloudflareProxy),
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingId) {
        const res = await fetch(`/api/profiles/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao atualizar perfil");
        }
      } else {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao criar perfil");
        }
      }
      setShowModal(false);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este perfil? Todo o histórico e favoritos serão perdidos.")) {
      return;
    }

    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao excluir perfil");
      }
      await loadProfiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir perfil");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 relative flex flex-col items-center justify-start p-6 pt-24 md:pt-32">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black" />
      </div>

      {/* Header */}
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

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-5xl space-y-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="space-y-1 text-center md:text-left"
          >
            <h1 className="text-4xl md:text-6xl font-black tracking-tight">Gerenciar Perfis</h1>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px]">Customize sua experiência pessoal</p>
          </motion.div>
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
          >
            <Link
              href="/profiles"
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-black text-xs uppercase tracking-widest border border-zinc-800 hover:border-white px-6 py-3 rounded-2xl"
            >
              <ChevronLeft size={16} />
              Concluído
            </Link>
          </motion.div>
        </div>

        {/* Profiles Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 md:gap-8">
          <AnimatePresence>
            {profiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: index * 0.05 }}
                className="group relative"
              >
                <div className="glass-card bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-6 flex flex-col items-center gap-6 group-hover:bg-zinc-800/60 transition-all duration-500 group-hover:border-white/20 group-hover:-translate-y-2">
                  {/* Avatar Container */}
                  <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center text-5xl md:text-6xl border-2 border-white/10 group-hover:border-white/30 transition-all">
                    {profile.avatar || DEFAULT_AVATARS[0]}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-2xl" />
                  </div>

                  <div className="text-center w-full space-y-1">
                    <p className="font-black tracking-tight text-white truncate px-2">{profile.name}</p>
                    {profile.isKids && (
                      <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">Kids</span>
                    )}
                  </div>

                  {/* Actions Overay-style buttons */}
                  <div className="flex w-full gap-2">
                    <button
                      onClick={() => openEditModal(profile)}
                      className="flex-1 flex items-center justify-center py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all border border-white/5 hover:border-white/20"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(profile.id)}
                      className="flex-1 flex items-center justify-center py-2.5 rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-500 transition-all border border-red-500/5 hover:border-red-500/30"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {profiles.length < 5 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={openCreateModal}
                className="group relative flex flex-col items-center justify-center gap-6 rounded-[32px] border-2 border-dashed border-zinc-800 hover:border-white/30 hover:bg-white/5 transition-all duration-500 p-8 min-h-[280px]"
              >
                <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center group-hover:scale-110 group-hover:bg-zinc-800 transition-all duration-500">
                  <Plus className="text-zinc-600 group-hover:text-white group-hover:rotate-90 transition-all duration-500" size={32} />
                </div>
                <p className="font-black text-zinc-500 group-hover:text-white uppercase tracking-widest text-xs">Adicionar Perfil</p>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Premium Creation/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-xl bg-zinc-900/90 border border-white/10 rounded-[40px] shadow-[0_40px_120px_rgba(0,0,0,0.9)] overflow-hidden"
            >
              {/* Internal Glow deco */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />

              <div className="p-10 md:p-14 space-y-10 relative z-10">
                <header className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tight">{editingId ? "Editar Perfil" : "Novo Perfil"}</h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Defina sua identidade</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all">
                    <X size={20} />
                  </button>
                </header>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                    <p className="text-red-400 text-sm font-bold text-center">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-10">
                  <div className="space-y-8">
                    {/* Name Input */}
                    <div className="group space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-4">Nome do Perfil</label>
                      <input
                        autoFocus
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        maxLength={20}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-5 px-6 text-xl font-black text-white focus:outline-none focus:border-primary/50 transition-all outline-none"
                        placeholder="Ex: Rafael"
                      />
                    </div>

                    {/* Avatar Picker */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-4">Escolha seu Avatar</label>
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                        {DEFAULT_AVATARS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setForm({ ...form, avatar: emoji })}
                            className={cn(
                              "relative h-12 w-12 flex items-center justify-center rounded-xl text-2xl transition-all duration-300",
                              form.avatar === emoji
                                ? "bg-primary scale-110 shadow-lg shadow-primary/40 ring-4 ring-primary/20"
                                : "bg-black/40 hover:bg-zinc-800 border border-white/5"
                            )}
                          >
                            {emoji}
                            {form.avatar === emoji && (
                              <div className="absolute -top-1 -right-1 bg-white text-primary rounded-full p-0.5">
                                <Check size={8} strokeWidth={4} />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, isKids: !form.isKids })}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all",
                          form.isKids ? "bg-blue-500/10 border-blue-500/50" : "bg-black/40 border-white/5"
                        )}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-xs font-black uppercase tracking-widest text-white">Perfil Kids</span>
                          <span className="text-[10px] text-zinc-500">Conteúdo seguro</span>
                        </div>
                        <div className={cn("w-10 h-6 rounded-full relative transition-colors", form.isKids ? "bg-blue-500" : "bg-zinc-800")}>
                          <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", form.isKids ? "left-5" : "left-1")} />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, useCloudflareProxy: !form.useCloudflareProxy })}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all",
                          form.useCloudflareProxy ? "bg-primary/10 border-primary/50" : "bg-black/40 border-white/5"
                        )}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-xs font-black uppercase tracking-widest text-white">Cloudflare</span>
                          <span className="text-[10px] text-zinc-500">Otimizar player</span>
                        </div>
                        <div className={cn("w-10 h-6 rounded-full relative transition-colors", form.useCloudflareProxy ? "bg-primary" : "bg-zinc-800")}>
                          <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", form.useCloudflareProxy ? "left-5" : "left-1")} />
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 py-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest text-xs transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] py-5 rounded-2xl bg-primary hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-primary/20 disabled:bg-zinc-800 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : (editingId ? "Salvar Alterações" : "Criar Perfil")}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
