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
  });

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
          deleteSourceAfterTranscode: Boolean(
            typeof data.deleteSourceAfterTranscode === "boolean"
              ? data.deleteSourceAfterTranscode
              : true,
          ),
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
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao salvar configurações");
      }

      setSettings({
        siteName: data.siteName,
        siteDescription: data.siteDescription,
        maintenanceMode: data.maintenanceMode,
        allowRegistration: data.allowRegistration,
        maxUploadSize: data.maxUploadSize,
        transcoderCrf: data.transcoderCrf,
        deleteSourceAfterTranscode: data.deleteSourceAfterTranscode,
      });

      toast.success("✅ Configurações salvas!");
    } catch (error: any) {
      console.error("Erro ao salvar configurações", error);
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold">⚙️ Configurações</h2>
        <p className="text-zinc-400 text-sm">
          Configure o comportamento geral do sistema.
        </p>
      </div>

      {initialLoading && (
        <div className="text-sm text-zinc-400">Carregando configurações...</div>
      )}

      {/* Geral */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-4">
        <h3 className="text-sm font-semibold">🌐 Geral</h3>
        
        <div className="space-y-2">
          <label className="block text-xs text-zinc-300">Nome do Site</label>
          <input
            type="text"
            value={settings.siteName}
            onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-zinc-300">Descrição</label>
          <textarea
            value={settings.siteDescription}
            onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.maintenanceMode}
            onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
          <label className="text-sm text-zinc-300">Modo de Manutenção</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.allowRegistration}
            onChange={(e) => setSettings({ ...settings, allowRegistration: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
          <label className="text-sm text-zinc-300">Permitir Novos Cadastros</label>
        </div>
      </div>

      {/* Upload */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-4">
        <h3 className="text-sm font-semibold">📤 Upload</h3>
        
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
      </div>

      {/* Transcodificação */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-4">
        <h3 className="text-sm font-semibold">🎬 Transcodificação</h3>
        
        <div className="space-y-2">
          <label className="block text-xs text-zinc-300">CRF Padrão (Qualidade)</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              value={settings.transcoderCrf}
              onChange={(e) => setSettings({ ...settings, transcoderCrf: parseInt(e.target.value) })}
              min={16}
              max={30}
              className="flex-1"
            />
            <span className="text-sm font-mono text-zinc-300 w-8">{settings.transcoderCrf}</span>
          </div>
          <p className="text-[10px] text-zinc-500">16 = Alta qualidade | 23 = Padrão | 30 = Baixa qualidade</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.deleteSourceAfterTranscode}
            onChange={(e) => setSettings({ ...settings, deleteSourceAfterTranscode: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
          <label className="text-sm text-zinc-300">Deletar arquivo original após transcodificação</label>
        </div>
      </div>

      {/* Versão */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
        <h3 className="text-sm font-semibold">🏷️ Versão do Sistema</h3>

        {versionError ? (
          <div className="text-sm text-zinc-400">{versionError}</div>
        ) : !versionInfo ? (
          <div className="text-sm text-zinc-400">Carregando versão...</div>
        ) : (
          <div className="space-y-1 text-sm text-zinc-300">
            <div>
              <span className="text-zinc-400">Versão:</span> {versionInfo.version || "-"}
            </div>
            <div>
              <span className="text-zinc-400">Commit:</span> {versionInfo.commitSha ? versionInfo.commitSha.slice(0, 7) : "-"}
            </div>
            <div className="text-xs text-zinc-500">
              {versionInfo.deploymentId ? `deploy: ${versionInfo.deploymentId}` : ""}
              {versionInfo.region ? `${versionInfo.deploymentId ? " • " : ""}region: ${versionInfo.region}` : ""}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Salvando..." : "💾 Salvar Configurações"}
      </button>
    </div>
  );
}
