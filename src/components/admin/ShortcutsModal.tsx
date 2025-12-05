"use client";

import { useState, useEffect } from "react";

export default function ShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleShowShortcuts() {
      setIsOpen(true);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    }

    window.addEventListener("show-shortcuts", handleShowShortcuts);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("show-shortcuts", handleShowShortcuts);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const shortcuts = [
    { keys: ["Ctrl", "K"], description: "Busca global" },
    { keys: ["Ctrl", "U"], description: "Ir para Upload" },
    { keys: ["Ctrl", "C"], description: "Ir para Catálogo" },
    { keys: ["Ctrl", "D"], description: "Ir para Dashboard" },
    { keys: ["Ctrl", "J"], description: "Ir para Jobs" },
    { keys: ["Ctrl", "/"], description: "Mostrar atalhos" },
    { keys: ["?"], description: "Mostrar atalhos" },
    { keys: ["Esc"], description: "Fechar modais" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-100">
            ⌨️ Atalhos de Teclado
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-zinc-400 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/50 p-3"
            >
              <span className="text-sm text-zinc-300">
                {shortcut.description}
              </span>
              <div className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-xs text-zinc-500">
          Pressione <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1">?</kbd> ou{" "}
          <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1">Ctrl+/</kbd> para abrir
        </div>
      </div>
    </div>
  );
}
