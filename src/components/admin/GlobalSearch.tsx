"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function handleOpenSearch() {
      setIsOpen(true);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    }

    window.addEventListener("open-search", handleOpenSearch);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("open-search", handleOpenSearch);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const results = [
    { type: "page", name: "Dashboard", path: "/admin" },
    { type: "page", name: "Catálogo", path: "/admin/catalog" },
    { type: "page", name: "Upload", path: "/admin/upload-v2" },
    { type: "page", name: "Jobs HLS", path: "/admin/jobs" },
    { type: "page", name: "Usuários", path: "/admin/users" },
    { type: "page", name: "Analytics", path: "/admin/analytics" },
    { type: "page", name: "Ações Rápidas", path: "/admin/quick-actions" },
    { type: "page", name: "Logs", path: "/admin/logs" },
    { type: "page", name: "Configurações", path: "/admin/settings" },
  ].filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  function handleSelect(path: string) {
    router.push(path);
    setIsOpen(false);
    setQuery("");
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-32">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-zinc-800 p-4">
          <input
            type="text"
            placeholder="🔍 Buscar páginas, títulos, usuários..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhum resultado encontrado
            </div>
          ) : (
            results.map((result) => (
              <button
                key={result.path}
                onClick={() => handleSelect(result.path)}
                className="group w-full rounded-lg px-4 py-3 text-left text-sm text-zinc-100 hover:bg-gradient-to-r hover:from-emerald-600/20 hover:to-blue-600/20 hover:border-emerald-500/30 border border-transparent transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase text-zinc-500">
                    {result.type}
                  </span>
                  <span>{result.name}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-zinc-800 p-3 text-xs text-zinc-500">
          <div className="flex items-center justify-between">
            <span>Use ↑↓ para navegar</span>
            <span>ESC para fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
