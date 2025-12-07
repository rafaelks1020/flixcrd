"use client";

import { useEffect, useState } from "react";

interface SettingsClientProps {
  initialUseCloudflareProxy: boolean;
}

export default function SettingsClient({ initialUseCloudflareProxy }: SettingsClientProps) {
  const [useCloudflareProxy, setUseCloudflareProxy] = useState(initialUseCloudflareProxy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUseCloudflareProxy(initialUseCloudflareProxy);
  }, [initialUseCloudflareProxy]);

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
    } catch (err: any) {
      setError(err.message ?? "Erro ao salvar configurações.");
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
      </div>
    </main>
  );
}
