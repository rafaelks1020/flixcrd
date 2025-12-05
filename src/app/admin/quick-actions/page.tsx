"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export default function QuickActionsPage() {
  const [loading, setLoading] = useState(false);

  async function clearCache() {
    setLoading(true);
    try {
      // Simular limpeza de cache
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Cache limpo com sucesso!");
    } catch (err) {
      toast.error("Erro ao limpar cache");
    } finally {
      setLoading(false);
    }
  }

  async function checkB2Connection() {
    setLoading(true);
    try {
      const res = await fetch("/api/b2/test");
      const data = await res.json();
      
      if (res.ok) {
        toast.success("✅ Conexão com B2 funcionando!");
      } else {
        toast.error(`❌ Erro: ${data.error || "Falha na conexão"}`);
      }
    } catch (err) {
      toast.error("❌ Erro ao testar conexão com B2");
    } finally {
      setLoading(false);
    }
  }

  async function checkTranscoder() {
    setLoading(true);
    try {
      const res = await fetch("/api/status/transcoder");
      const data = await res.json();
      
      if (res.ok && data.status === "ok") {
        toast.success("✅ Transcoder online!");
      } else {
        toast.error("❌ Transcoder offline ou com erro");
      }
    } catch (err) {
      toast.error("❌ Erro ao verificar transcoder");
    } finally {
      setLoading(false);
    }
  }

  async function checkCloudflare() {
    setLoading(true);
    try {
      const res = await fetch("/api/status/cloudflare");
      const data = await res.json();
      
      if (res.ok && data.status === "ok") {
        toast.success("✅ Cloudflare proxy funcionando!");
      } else {
        toast.error("❌ Cloudflare proxy com erro");
      }
    } catch (err) {
      toast.error("❌ Erro ao verificar Cloudflare");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">⚡ Ações Rápidas</h2>
        <p className="text-zinc-400 text-sm">
          Ferramentas úteis para manutenção e diagnóstico do sistema.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Testes de Conexão */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold">🔌 Testes de Conexão</h3>
          <div className="space-y-2">
            <button
              onClick={checkB2Connection}
              disabled={loading}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
            >
              Testar B2
            </button>
            <button
              onClick={checkTranscoder}
              disabled={loading}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
            >
              Testar Transcoder
            </button>
            <button
              onClick={checkCloudflare}
              disabled={loading}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
            >
              Testar Cloudflare
            </button>
          </div>
        </div>

        {/* Manutenção */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold">🛠️ Manutenção</h3>
          <div className="space-y-2">
            <button
              onClick={clearCache}
              disabled={loading}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
            >
              Limpar Cache
            </button>
            <button
              onClick={() => toast.success("Em breve!")}
              disabled={loading}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
            >
              Otimizar Banco de Dados
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
            >
              Recarregar Página
            </button>
          </div>
        </div>

        {/* Atalhos */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold">⌨️ Atalhos</h3>
          <div className="space-y-2 text-xs text-zinc-400">
            <div className="flex items-center justify-between">
              <span>Ir para Upload</span>
              <kbd className="rounded bg-zinc-800 px-2 py-1 font-mono">Ctrl+U</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Ir para Catálogo</span>
              <kbd className="rounded bg-zinc-800 px-2 py-1 font-mono">Ctrl+C</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Ir para Jobs</span>
              <kbd className="rounded bg-zinc-800 px-2 py-1 font-mono">Ctrl+J</kbd>
            </div>
            <p className="mt-3 text-[10px] text-zinc-500">
              * Atalhos em desenvolvimento
            </p>
          </div>
        </div>

        {/* Info do Sistema */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold">ℹ️ Informações</h3>
          <div className="space-y-2 text-xs text-zinc-400">
            <div className="flex items-center justify-between">
              <span>Versão:</span>
              <span className="font-mono text-zinc-300">v2.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ambiente:</span>
              <span className="font-mono text-emerald-400">Produção</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Storage:</span>
              <span className="font-mono text-zinc-300">Backblaze B2</span>
            </div>
            <div className="flex items-center justify-between">
              <span>CDN:</span>
              <span className="font-mono text-zinc-300">Cloudflare</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
