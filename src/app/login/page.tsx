"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, LogIn, Sparkles, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result && !result.error) {
        router.push("/");
        router.refresh();
        return;
      }
      setFormError("Credenciais inválidas. Verifique email e senha.");
    } catch (err) {
      setFormError("Ocorreu um erro ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-primary/30 overflow-hidden flex flex-col items-center justify-center p-6">
      {/* Cinematic Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-black to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent" />

        {/* Animated Bokeh / Particles (Subtle) */}
        <motion.div
          animate={{
            opacity: [0.1, 0.2, 0.1],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            opacity: [0.05, 0.15, 0.05],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear", delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-red-900/10 rounded-full blur-[150px]"
        />
      </div>

      {/* Floating Logo / Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-12 left-12 z-20 flex items-center gap-4 hidden md:flex"
      >
        <Link href="/" className="group flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Sparkles size={20} className="text-white fill-white" />
          </div>
          <span className="text-3xl font-black tracking-tighter bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Pflix
          </span>
        </Link>
      </motion.div>

      {/* Back button for logic/ux */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="absolute top-12 right-12 z-20"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-bold text-sm uppercase tracking-widest"
        >
          <ChevronLeft size={16} />
          Voltar
        </Link>
      </motion.div>

      {/* Login Card Container */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-card bg-zinc-900/40 backdrop-blur-2xl rounded-[32px] border border-white/10 p-10 md:p-12 shadow-[0_32px_100px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Internal Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />

          <div className="relative space-y-8">
            <header className="text-center space-y-2">
              <h1 className="text-4xl font-black tracking-tight text-white">
                Bem-vindo
              </h1>
              <p className="text-zinc-500 font-medium">
                Sua jornada cinematográfica continua aqui.
              </p>
            </header>

            <AnimatePresence mode="wait">
              {formError && (
                <motion.div
                  initial={{ height: 0, opacity: 0, y: -10 }}
                  animate={{ height: "auto", opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -10 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4"
                >
                  <p className="text-red-400 text-sm font-bold text-center">
                    {formError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                <div className="group space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-4 group-focus-within:text-primary transition-colors">
                    Endereço de Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-primary transition-colors" size={20} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="group space-y-2">
                  <div className="flex items-center justify-between ml-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-focus-within:text-primary transition-colors">
                      Sua Senha
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
                    >
                      Esqueceu?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-primary transition-colors" size={20} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full h-[64px] bg-primary hover:bg-red-700 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white font-black text-lg rounded-2xl transition-all shadow-[0_12px_40px_rgba(229,9,20,0.3)] hover:shadow-[0_20px_60px_rgba(229,9,20,0.4)] transform hover:-translate-y-1 active:translate-y-0 overflow-hidden"
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  {loading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <>
                      <span>Entrar</span>
                      <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
                {/* Shine Animation */}
                {!loading && (
                  <motion.div
                    initial={{ left: "-100%" }}
                    whileHover={{ left: "100%" }}
                    transition={{ duration: 0.6 }}
                    className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]"
                  />
                )}
              </button>
            </form>

            <footer className="pt-4 text-center">
              <p className="text-zinc-500 font-bold text-sm">
                Ainda não tem conta?{" "}
                <Link
                  href="/register"
                  className="text-white hover:text-primary transition-colors underline underline-offset-8 decoration-white/20 hover:decoration-primary"
                >
                  Crie sua conta agora
                </Link>
              </p>
            </footer>
          </div>
        </div>

        {/* Decorative elements around card */}
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl animate-pulse delay-700" />
      </motion.div>

      {/* Footer Info */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 text-[10px] uppercase tracking-[0.3em] font-black text-zinc-700"
      >
        © 2024 Pflix Corporation • Privacidade & Termos
      </motion.p>
    </div>
  );
}
