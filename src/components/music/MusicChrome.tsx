"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PlayerBar } from "./PlayerBar";
import { usePlayer } from "./PlayerContext";

const HIDDEN_PREFIXES = ["/watch", "/admin", "/lab/watch", "/login"];

export function MusicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const { current, pause } = usePlayer();
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const showBar = Boolean(current) && !hidden;

  useEffect(() => {
    if (hidden) pause();
  }, [hidden, pause]);

  return (
    <>
      <div className={showBar ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : undefined}>{children}</div>
      {showBar ? <PlayerBar /> : null}
    </>
  );
}
