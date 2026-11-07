"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface SettingsState {
  siteName: string;
  siteDescription: string;
  maintenanceMode: boolean;
  allowRegistration: boolean;
  maxUploadSize: number;
  transcoderCrf: number;
  deleteSourceAfterTranscode: boolean;

  // Content
  hideAdultContent: boolean;
  adultContentPin: string;
  hasAdultContentPin: boolean;

  // Categories
  enableMovies: boolean;
  enableSeries: boolean;
  enableAnimes: boolean;
  enableDoramas: boolean;
}

interface VersionInfo {
  name?: string;
  version?: string;
  commitSha?: string | null;
  commitRef?: string | null;
  deploymentId?: string | null;
  region?: string | null;
  serverTime?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    siteName: "Pflix",
    siteDescription: "Sua plataforma de streaming",
    maintenanceMode: false,
    allowRegistration: true,
    maxUploadSize: 10,
    transcoderCrf: 20,
    deleteSourceAfterTranscode: true,
    hideAdultContent: false,
    adultContentPin: "",
    hasAdultContentPin: false,
    enableMovies: true,
    enableSeries: true,
    enableAnimes: true,
    enableDoramas: true,
  });

  const [removePin, setRemovePin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Erro ao carregar configurações");
        }
        const data = await res.json();

        setSettings({
          siteName: data.siteName ?? "Pflix",
          siteDescription: data.siteDescription ?? "Sua plataforma de streaming",
          maintenanceMode: Boolean(data.maintenanceMode),
          allowRegistration: Boolean(data.allowRegistration ?? true),
          maxUploadSize: Number.isFinite(data.maxUploadSize) ? data.maxUploadSize : 10,
          transcoderCrf: Number.isFinite(data.transcoderCrf) ? data.transcoderCrf : 20,
          deleteSourceAfterTranscode: Boolean(data.deleteSourceAfterTranscode ?? true),

          hideAdultContent: Boolean(data.hideAdultContent),
          adultContentPin: "",
          hasAdultContentPin: Boolean(data.hasAdultContentPin),

          enableMovies: data.enableMovies !== false,
          enableSeries: data.enableSeries !== false,
          enableAnimes: data.enableAnimes !== false,
          enableDoramas: data.enableDoramas !== false,
        });
      } catch (error) {
        console.error("Erro ao carregar configurações", error);
        toast.error("Erro ao carregar configurações");
      } finally {
        setInitialLoading(false);
      }
    }

    async function loadVersion() {
      try {
        setVersionError(null);
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Erro ao carregar versão");
        }
        const data = await res.json();
        setVersionInfo(data);
      } catch (error) {
        console.error("Erro ao carregar versão", error);
        setVersionError("Erro ao carregar versão");
      }
    }

    loadSettings();
    loadVersion();
  }, []);

  async function handleSave() {
    try {
      setLoading(true);
      const { adultContentPin, hasAdultContentPin, ...dataToSave } = settings;
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...dataToSave,
          ...(removePin ? { adultContentPin: null } : adultContentPin ? { adultContentPin } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao salvar configurações");
      }

      setSettings(prev => ({ ...prev, ...data, adultContentPin: "" }));
      setRemovePin(false);
      toast.success("✅ Configurações salvas!");
    } catch (error: any) {
      console.error("Erro ao salvar configurações", error);
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl pb-20">
      <div>
        <h2 className="text-2xl font-semibold">⚙️ Configurações</h2>
        <p className="text-zinc-400 text-sm">
          Configure o comportamento geral do sistema, streaming e integrações.
        </p>
      </div>

      {initialLoading && (
        <div className="text-sm text-zinc-400">Carregando configurações...</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Coluna 1: Geral e Upload */}
        <div className="space-y-6">
          {/* Geral */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">🌐 Geral</h3>

            <div className="space-y-2">
              <label className="block text-xs text-zinc-300">Nome do Site</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-zinc-300">Descrição</label>
              <textarea
                value={settings.siteDescription}
                onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <label className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-900/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="h-4 w-4 accent-emerald-500 rounded border-zinc-700 bg-zinc-800"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-300">Modo de Manutenção</span>
                  <span className="text-xs text-zinc-500">Apenas admins podem acessar o site</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-900/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={settings.allowRegistration}
                  onChange={(e) => setSettings({ ...settings, allowRegistration: e.target.checked })}
                  className="h-4 w-4 accent-emerald-500 rounded border-zinc-700 bg-zinc-800"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-300">Permitir Novos Cadastros</span>
                  <span className="text-xs text-zinc-500">Usuários podem criar conta livremente</span>
                </div>
              </label>
            </div>
          </div>

          {/* Upload e transcodificação do catálogo próprio */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5 space-y-4">
              <h3 className="text-sm font-semibold">🎬 Upload & Mídia</h3>

              <div className="space-y-2">
                <label className="block text-xs text-zinc-300">Tamanho Máximo (GB)</label>
                <input
                  type="number"
                  value={settings.maxUploadSize}
                  onChange={(e) => setSettings({ ...settings, maxUploadSize: parseInt(e.target.value) })}
                  min={1}
                  max={50}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
                <p className="text-[10px] text-zinc-500">Limite por arquivo individual</p>
              </div>

              <div className="pt-2 border-t border-zinc-800/50">
                <div className="space-y-2 mt-3">
                  <label className="block text-xs text-zinc-300">CRF Transcoder (Qualidade: {settings.transcoderCrf})</label>
                  <input
                    type="range"
                    value={settings.transcoderCrf}
                    onChange={(e) => setSettings({ ...settings, transcoderCrf: parseInt(e.target.value) })}
                    min={16}
                    max={30}
                    className="w-full accent-emerald-500"
                  />
                  <p className="text-[10px] text-zinc-500 flex justify-between">
                    <span>Alta (16)</span>
                    <span>Baixa (30)</span>
                  </p>
                </div>

                <label className="flex items-center gap-3 p-2 mt-2 rounded-md hover:bg-zinc-900/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={settings.deleteSourceAfterTranscode}
                    onChange={(e) => setSettings({ ...settings, deleteSourceAfterTranscode: e.target.checked })}
                    className="h-4 w-4 accent-emerald-500 rounded border-zinc-700 bg-zinc-800"
                  />
                  <span className="text-sm text-zinc-300">Deletar original após converter</span>
                </label>
              </div>
            </div>
        </div>

        {/* Coluna 2: categorias e filtro de conteúdo */}
        <div className="space-y-6">

          {/* Categorias */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">📂 Categorias Ativas</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "enableMovies", label: "Filmes" },
                { key: "enableSeries", label: "Séries" },
                { key: "enableAnimes", label: "Animes" },
                { key: "enableDoramas", label: "Doramas" },
              ].map((cat) => (
                <label key={cat.key} className="flex items-center gap-2 p-2 rounded border border-zinc-800 bg-zinc-900/50 cursor-pointer hover:bg-zinc-900 transition-colors">
                  <input
                    type="checkbox"
                    checked={(settings as any)[cat.key]}
                    onChange={(e) => setSettings({ ...settings, [cat.key]: e.target.checked })}
                    className="h-4 w-4 accent-emerald-500 rounded"
                  />
                  <span className="text-sm text-zinc-300">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Content Safety */}
          <div className="rounded-lg border border-red-900/20 bg-red-950/10 p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-red-400">🔞 Filtro de Conteúdo</h3>

            <label className="flex items-center gap-3 p-2 rounded-md hover:bg-red-950/20 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={settings.hideAdultContent}
                onChange={(e) => setSettings({ ...settings, hideAdultContent: e.target.checked })}
                className="h-4 w-4 accent-red-500 rounded border-red-900/50 bg-red-950/30"
              />
              <div className="flex flex-col">
                <span className="text-sm text-red-200">Ocultar Conteúdo +18</span>
                <span className="text-xs text-red-400/70">Bloqueia filmes e séries marcados como adulto.</span>
              </div>
            </label>

            {settings.hideAdultContent && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <label htmlFor="adult-content-pin" className="block text-xs text-red-300">PIN de Controle Parental (Opcional)</label>
                <input
                  id="adult-content-pin"
                  type="password"
                  autoComplete="new-password"
                  disabled={removePin}
                  value={settings.adultContentPin || ""}
                  onChange={(e) => setSettings({ ...settings, adultContentPin: e.target.value })}
                  placeholder={settings.hasAdultContentPin && !removePin ? "PIN definido" : "Ex: 1234"}
                  maxLength={4}
                  className="w-32 rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-100 placeholder:text-red-500/40 focus:border-red-500 focus:outline-none"
                />
                {settings.hasAdultContentPin && (
                  <label className="flex items-center gap-2 text-xs text-red-300">
                    <input type="checkbox" checked={removePin} onChange={(e) => setRemovePin(e.target.checked)} />
                    Remover PIN
                  </label>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Versão (Rodapé) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 flex flex-wrap gap-6 items-center justify-between text-xs text-zinc-500">
        <div className="flex gap-4">
          <span>Versão: <span className="text-zinc-300">{versionInfo?.version || "-"}</span></span>
          <span>Commit: <span className="text-zinc-300 font-mono">{versionInfo?.commitSha?.slice(0, 7) || "-"}</span></span>
        </div>
        <div>
          {versionInfo?.deploymentId && <span>Deploy: {versionInfo.deploymentId}</span>}
        </div>
      </div>

      <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-80">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full shadow-xl shadow-emerald-500/10 rounded-lg bg-emerald-600 px-6 py-4 text-sm font-bold text-white hover:bg-emerald-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            "💾 Salvar Alterações"
          )}
        </button>
      </div>
    </div>
  );
}
