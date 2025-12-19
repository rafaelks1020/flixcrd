"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings as SettingsIcon,
  Smartphone,
  BellRing,
  Cloud,
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
  Download,
  Info,
  ShieldCheck,
  ChevronLeft,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SettingsClientProps {
  initialUseCloudflareProxy: boolean;
}

export default function SettingsClient({ initialUseCloudflareProxy }: SettingsClientProps) {
  const [useCloudflareProxy, setUseCloudflareProxy] = useState(initialUseCloudflareProxy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [webPushSupported, setWebPushSupported] = useState(false);
  const [webPushPermission, setWebPushPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [webPushSubscribed, setWebPushSubscribed] = useState(false);
  const [webPushBusy, setWebPushBusy] = useState(false);
  const [webPushError, setWebPushError] = useState<string | null>(null);

  useEffect(() => {
    setUseCloudflareProxy(initialUseCloudflareProxy);
  }, [initialUseCloudflareProxy]);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      typeof Notification !== "undefined";
    setWebPushSupported(supported);
  }, []);

  useEffect(() => {
    async function refresh() {
      if (!webPushSupported) return;
      setWebPushError(null);
      try {
        setWebPushPermission(Notification.permission);
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setWebPushSubscribed(Boolean(sub));
      } catch {
        setWebPushSubscribed(false);
      }
    }

    refresh();
  }, [webPushSupported]);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function handleEnableWebPush() {
    if (!webPushSupported) return;
    setWebPushBusy(true);
    setWebPushError(null);
    try {
      const permission = await Notification.requestPermission();
      setWebPushPermission(permission);
      if (permission !== "granted") {
        throw new Error("Permissão negada. Ative as notificações nas configurações do navegador.");
      }

      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/webpush/public-key");
      const keyJson = await keyRes.json().catch(() => null);
      if (!keyRes.ok) {
        throw new Error(keyJson?.error ?? "Web Push não configurado no servidor.");
      }

      const publicKey = keyJson?.publicKey;
      if (!publicKey || typeof publicKey !== "string") {
        throw new Error("Chave pública VAPID inválida.");
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const saveRes = await fetch("/api/webpush/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      const saveJson = await saveRes.json().catch(() => null);
      if (!saveRes.ok) {
        throw new Error(saveJson?.error ?? "Falha ao salvar subscription.");
      }

      setWebPushSubscribed(true);
    } catch (err) {
      setWebPushError(err instanceof Error ? err.message : "Erro ao ativar notificações.");
      setWebPushSubscribed(false);
    } finally {
      setWebPushBusy(false);
    }
  }

  async function handleDisableWebPush() {
    if (!webPushSupported) return;
    setWebPushBusy(true);
    setWebPushError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;

      if (endpoint) {
        await fetch("/api/webpush/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => null);
      }

      await sub?.unsubscribe?.();
      setWebPushSubscribed(false);
    } catch (err) {
      setWebPushError(err instanceof Error ? err.message : "Erro ao desativar notificações.");
    } finally {
      setWebPushBusy(false);
    }
  }

  async function handleToggle() {
    const next = !useCloudflareProxy;
    setUseCloudflareProxy(next);
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useCloudflareProxy: next }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? "Erro ao salvar configurações.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações.");
      setUseCloudflareProxy((prev) => !prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 relative flex flex-col items-center p-6 pt-24 md:pt-32 overflow-x-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black" />
        <div className="absolute top-0 right-0 w-full h-[30vh] bg-primary/5 blur-[100px] rounded-full" />
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

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl space-y-12 pb-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="space-y-1 text-center md:text-left"
          >
            <h1 className="text-4xl md:text-6xl font-black tracking-tight flex items-center gap-4 justify-center md:justify-start">
              Configurações
            </h1>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px]">Customize sua plataforma</p>
          </motion.div>

          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
          >
            <Link
              href="/"
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-black text-xs uppercase tracking-widest border border-zinc-800 hover:border-white px-6 py-3 rounded-2xl"
            >
              <ChevronLeft size={16} />
              Voltar ao Início
            </Link>
          </motion.div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">

          {/* Section: Streaming */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] overflow-hidden"
          >
            <div className="p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="flex gap-6 items-start">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Cloud size={28} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black tracking-tight">Proxy Cloudflare</h2>
                  <p className="text-zinc-500 text-sm leading-relaxed max-w-md font-medium">
                    Otimiza a rota de streaming para evitar engasgos em conexões com rotas internacionais ruins.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                <button
                  onClick={handleToggle}
                  disabled={saving}
                  className={cn(
                    "relative w-16 h-8 rounded-full transition-all duration-300 transform active:scale-95",
                    useCloudflareProxy ? "bg-primary shadow-[0_0_20px_rgba(229,9,20,0.4)]" : "bg-zinc-800"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md",
                    useCloudflareProxy ? "left-9" : "left-1"
                  )} />
                </button>
                <AnimatePresence>
                  {saving && (
                    <motion.p
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"
                    >
                      <Loader2 size={12} className="animate-spin" />
                      Sincronizando...
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
            {error && (
              <div className="px-8 pb-8">
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <AlertCircle className="text-red-400 shrink-0" size={18} />
                  <p className="text-red-400 text-xs font-bold uppercase tracking-wide">{error}</p>
                </div>
              </div>
            )}
          </motion.section>

          {/* Section: Mobile App */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8"
          >
            <div className="flex gap-6 items-start">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <Smartphone size={28} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black tracking-tight">App Android (APK)</h2>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest">v2.4.0</span>
                </div>
                <p className="text-zinc-500 text-sm leading-relaxed max-w-md font-medium">
                  Leve o cinema no bolso. Instale nativamente para melhor performance e suporte a offline.
                </p>
              </div>
            </div>

            <a
              href="/paelflix.apk"
              className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-white text-black hover:bg-zinc-200 transition-all px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 shadow-xl shadow-white/5"
            >
              <Download size={18} />
              Baixar APK
            </a>
          </motion.section>

          {/* Section: Notifications */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] overflow-hidden"
          >
            <div className="p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="flex gap-6 items-start">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <BellRing size={28} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black tracking-tight">Notificações Push</h2>
                  <p className="text-zinc-500 text-sm leading-relaxed max-w-md font-medium">
                    Saiba instantaneamente quando novos episódios ou filmes saírem. Requer instalação como PWA.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                {webPushSupported ? (
                  <button
                    onClick={webPushSubscribed ? handleDisableWebPush : handleEnableWebPush}
                    disabled={webPushBusy}
                    className={cn(
                      "w-20 h-10 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-center",
                      webPushSubscribed
                        ? "bg-zinc-800 text-zinc-400 hover:text-white"
                        : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
                    )}
                  >
                    {webPushBusy ? <Loader2 size={16} className="animate-spin" /> : (webPushSubscribed ? "Ativo" : "Ativar")}
                  </button>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700">Não Suportado</span>
                )}
              </div>
            </div>

            {webPushError && (
              <div className="px-8 pb-8">
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <AlertCircle className="text-red-400 shrink-0" size={18} />
                  <p className="text-red-400 text-xs font-bold uppercase tracking-wide">{webPushError}</p>
                </div>
              </div>
            )}

            {/* Notification Status Footer */}
            {webPushSupported && (
              <div className="px-8 py-4 bg-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", webPushSubscribed ? "bg-emerald-500" : "bg-zinc-700")} />
                    <span>Sub: {webPushSubscribed ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={12} className={cn(webPushPermission === "granted" ? "text-emerald-500" : "text-zinc-700")} />
                    <span>Permission: {webPushPermission}</span>
                  </div>
                </div>
                <Info size={12} className="cursor-help hover:text-white transition-colors" />
              </div>
            )}
          </motion.section>

        </div>

        {/* Legal Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-6">
            <Link href="/terms" className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-white transition-colors">Termos</Link>
            <Link href="/privacy" className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-white transition-colors">Privacidade</Link>
            <Link href="/cookies" className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-white transition-colors">Cookies</Link>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-800">
            Powered by Pflix OS v4.2 Elite
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
