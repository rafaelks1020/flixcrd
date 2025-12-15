"use client";

import { useEffect, useState } from "react";

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
      // Reverter visualmente em caso de falha
      setUseCloudflareProxy((prev) => !prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-zinc-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-semibold">Configurações</h1>

        <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-zinc-100">Usar proxy Cloudflare para streaming</p>
              <p className="text-xs text-zinc-400">
                Quando ativo, o player pode usar o proxy Cloudflare para tentar melhorar o streaming em conexões mais lentas.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full border px-0.5 text-[11px] transition ${{
                true: "border-emerald-500 bg-emerald-600",
                false: "border-zinc-600 bg-zinc-800",
              }[String(useCloudflareProxy) as "true" | "false"]}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-zinc-50 transition-transform ${
                  useCloudflareProxy ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {saving && (
            <p className="text-[11px] text-zinc-400">Salvando...</p>
          )}
          {error && (
            <p className="text-[11px] text-red-400">{error}</p>
          )}
        </section>
        <section className="mt-6 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-zinc-100">Baixar app Android (APK)</p>
              <p className="text-xs text-zinc-400">
                Instale o aplicativo nativo do Pflix no seu dispositivo Android baixando diretamente este arquivo.
              </p>
            </div>
            <a
              href="/paelflix.apk"
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 transition"
            >
              <span>Baixar APK</span>
            </a>
          </div>
          <p className="text-[11px] text-zinc-500">
            Ao instalar o APK, talvez seja necessário permitir instalações de fontes desconhecidas nas configurações do seu
            Android.
          </p>
        </section>

        <section className="mt-6 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-zinc-100">Notificações Push (PWA)</p>
              <p className="text-xs text-zinc-400">
                Receba avisos mesmo com o app fechado. No iPhone/iPad, o push só funciona quando instalado na tela inicial
                (iOS 16.4+).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {webPushSupported ? (
                webPushSubscribed ? (
                  <button
                    type="button"
                    onClick={handleDisableWebPush}
                    disabled={webPushBusy}
                    className="inline-flex items-center gap-2 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition disabled:opacity-60"
                  >
                    <span>Desativar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnableWebPush}
                    disabled={webPushBusy}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-60"
                  >
                    <span>Ativar</span>
                  </button>
                )
              ) : (
                <span className="text-xs text-zinc-500">Indisponível</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
            <span>
              Status: {webPushSupported ? (webPushSubscribed ? "Ativo" : "Inativo") : "Não suportado"}
            </span>
            <span>
              Permissão: {webPushSupported ? webPushPermission : "-"}
            </span>
          </div>

          {webPushBusy && <p className="text-[11px] text-zinc-400">Processando...</p>}
          {webPushError && <p className="text-[11px] text-red-400">{webPushError}</p>}
        </section>
      </div>
    </main>
  );
}
