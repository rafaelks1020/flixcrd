"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const PWA_INSTALL_DISMISS_KEY = "pwa_install_dismissed_until_v1";
const PWA_INSTALL_DISMISS_DAYS = 7;

function getDismissUntil() {
  try {
    const raw = window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function setDismissForDays(days: number) {
  try {
    const ms = Date.now() + days * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(PWA_INSTALL_DISMISS_KEY, String(ms));
  } catch {
  }
}

export default function ServiceWorkerRegister() {
  const deferredPromptRef = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const cleanupVisibilityRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Registrar Service Worker
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" as any })
        .then((registration) => {
          console.log("[PWA] Service Worker registrado:", registration.scope);
          
          // Verificar atualizações
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[PWA] Nova versão disponível");
                  toast((t) => (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-semibold">Atualização disponível</div>
                        <div className="text-xs text-zinc-300">Recarregue para aplicar a nova versão.</div>
                      </div>
                      <button
                        className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                        onClick={() => {
                          toast.dismiss(t.id);
                          try {
                            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
                          } catch {
                          }
                          setTimeout(() => window.location.reload(), 250);
                        }}
                      >
                        Atualizar
                      </button>
                    </div>
                  ), { duration: 120000 });
                }
              });
            }
          });

          // Checar se já existe SW em waiting (reload anterior)
          if (registration.waiting && navigator.serviceWorker.controller) {
            // no-op: apenas mantém o estado do app ciente que há update pronto
          }

          // Atualizar em background quando voltar ao app
          const onVisibility = () => {
            if (document.visibilityState === "visible") {
              registration.update().catch(() => {});
            }
          };
          document.addEventListener("visibilitychange", onVisibility);
          cleanupVisibilityRef.current = () => document.removeEventListener("visibilitychange", onVisibility);
        })
        .catch((error) => {
          console.error("[PWA] Erro ao registrar Service Worker:", error);
        });
    }

    return () => {
      cleanupVisibilityRef.current?.();
      cleanupVisibilityRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstallPrompt = (event: any) => {
      try {
        const until = getDismissUntil();
        if (until && Date.now() < until) {
          return;
        }
      } catch {
      }
      event.preventDefault();
      deferredPromptRef.current = event;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isStandalone =
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      (navigator as any).standalone === true;

    if (!isIOS || isStandalone) return;

    const key = "pwa_ios_install_hint_v1";
    try {
      if (window.localStorage.getItem(key) === "1") return;
      window.localStorage.setItem(key, "1");
    } catch {
    }

    toast(
      <div className="text-sm">
        <div className="font-semibold">Instalar no iPhone/iPad</div>
        <div className="text-xs text-zinc-300">
          Abra o menu de compartilhar do Safari e toque em “Adicionar à Tela de Início”.
        </div>
      </div>,
      { duration: 12000 },
    );
  }, []);

  useEffect(() => {
    if (!canInstall) return;

    if (process.env.NODE_ENV === "development") {
      setCanInstall(false);
      return;
    }

    try {
      const until = getDismissUntil();
      if (until && Date.now() < until) {
        setCanInstall(false);
        return;
      }
    } catch {
    }

    toast((t) => (
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold">Instalar o Pflix</div>
          <div className="text-xs text-zinc-300">Deixe com cara de app na sua tela inicial.</div>
        </div>
        <button
          className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          onClick={async () => {
            const dp = deferredPromptRef.current;
            if (!dp) return;
            try {
              dp.prompt();
              await dp.userChoice;
            } catch {
            } finally {
              deferredPromptRef.current = null;
              setCanInstall(false);
              toast.dismiss(t.id);
            }
          }}
        >
          Instalar
        </button>
        <button
          className="rounded-md px-2 py-2 text-xs font-semibold text-zinc-200 hover:text-white"
          onClick={() => {
            setDismissForDays(PWA_INSTALL_DISMISS_DAYS);
            setCanInstall(false);
            toast.dismiss(t.id);
          }}
        >
          Agora não
        </button>
      </div>
    ), { duration: 15000 });
  }, [canInstall]);

  return null;
}
