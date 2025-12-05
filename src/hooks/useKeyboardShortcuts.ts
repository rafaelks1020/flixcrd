import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

export function useAdminShortcuts() {
  const router = useRouter();

  const shortcuts: Shortcut[] = [
    {
      key: "k",
      ctrl: true,
      action: () => {
        const event = new CustomEvent("open-search");
        window.dispatchEvent(event);
      },
      description: "Busca global",
    },
    {
      key: "u",
      ctrl: true,
      action: () => router.push("/admin/upload-v2"),
      description: "Ir para Upload",
    },
    {
      key: "c",
      ctrl: true,
      action: () => router.push("/admin/catalog"),
      description: "Ir para Catálogo",
    },
    {
      key: "d",
      ctrl: true,
      action: () => router.push("/admin"),
      description: "Ir para Dashboard",
    },
    {
      key: "j",
      ctrl: true,
      action: () => router.push("/admin/jobs"),
      description: "Ir para Jobs",
    },
    {
      key: "/",
      ctrl: true,
      action: () => {
        const event = new CustomEvent("show-shortcuts");
        window.dispatchEvent(event);
      },
      description: "Mostrar atalhos",
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}
