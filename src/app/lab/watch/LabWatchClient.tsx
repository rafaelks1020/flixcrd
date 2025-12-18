"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import PremiumNavbar from "@/components/ui/PremiumNavbar";
import { makeLabTitleKey, upsertLabContinue } from "../labStorage";

const SUPERFLIX_BASE = "https://superflixapi.run";

interface LabWatchClientProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  type: "filme" | "serie";
  contentId: string;
  initialSeason: string;
  initialEpisode: string;
  tmdbId?: string;
}

export default function LabWatchClient({
  isLoggedIn,
  isAdmin,
  type,
  contentId,
  initialSeason,
  initialEpisode,
  tmdbId,
}: LabWatchClientProps) {
  const router = useRouter();
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);

  const resolvedTmdbId = useMemo(() => {
    const n = Number(tmdbId || "");
    if (Number.isFinite(n) && n > 0) return n;
    const fromContent = Number(contentId);
    if (type === "serie" && Number.isFinite(fromContent) && fromContent > 0) return fromContent;
    if (type === "filme" && Number.isFinite(fromContent) && fromContent > 0) return fromContent;
    return 0;
  }, [tmdbId, contentId, type]);

  const continueKey = useMemo(() => {
    if (resolvedTmdbId > 0) {
      return makeLabTitleKey(type === "filme" ? "movie" : "tv", resolvedTmdbId);
    }
    return `lab-${type}-${contentId}`;
  }, [resolvedTmdbId, type, contentId]);

  const watchUrl = useMemo(() => {
    const base = `/lab/watch?type=${type}&id=${encodeURIComponent(contentId)}`;
    const parts: string[] = [];
    if (type === "serie") {
      parts.push(`season=${encodeURIComponent(season)}`);
      parts.push(`episode=${encodeURIComponent(episode)}`);
    }
    if (resolvedTmdbId > 0) {
      parts.push(`tmdb=${encodeURIComponent(String(resolvedTmdbId))}`);
    }
    return parts.length ? `${base}&${parts.join("&")}` : base;
  }, [type, contentId, season, episode, resolvedTmdbId]);

  const continueContentId = useMemo(() => {
    if (type === "filme" && resolvedTmdbId > 0) return String(resolvedTmdbId);
    return contentId;
  }, [type, resolvedTmdbId, contentId]);

  useEffect(() => {
    if (!contentId) return;
    upsertLabContinue({
      key: continueKey,
      watchUrl,
      title: "",
      posterUrl: null,
      watchType: type,
      contentId: continueContentId,
      season: type === "serie" ? Number(season) : undefined,
      episode: type === "serie" ? Number(episode) : undefined,
    });
  }, [continueKey, watchUrl, type, contentId, continueContentId, season, episode]);

  const embedOptions = {
    transparent: true,
    noBackground: true,
  };

  function buildEmbedUrl() {
    // Usar endpoint /filme/ ou /serie/ direto (como na documentação)
    // Evita problemas de origin/proxy que podem quebrar os cliques no player.
    let url = `${SUPERFLIX_BASE}/${type}/${encodeURIComponent(contentId)}`;

    if (type === "serie") {
      url += `/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;
    }

    // Adicionar parâmetros de hash para personalização visual
    const hashParams: string[] = [];
    if (embedOptions.transparent) hashParams.push("transparent");
    if (embedOptions.noBackground) hashParams.push("noBackground");

    if (hashParams.length > 0) {
      url += "#" + hashParams.join("#");
    }

    return url;
  }

  if (!contentId) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
        <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "calc(100vh - 72px)",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.7)" }}>
            Nenhum conteúdo selecionado
          </div>
          <Link
            href="/lab"
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              background: "#e50914",
              color: "#fff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Voltar ao Catálogo
          </Link>
        </div>
      </div>
    );
  }

  function handleSeasonChange(newSeason: string) {
    setSeason(newSeason);
    setEpisode("1");
    router.push(`/lab/watch?type=${type}&id=${contentId}&season=${newSeason}&episode=1`);
  }

  function handleEpisodeChange(newEpisode: string) {
    setEpisode(newEpisode);
    router.push(`/lab/watch?type=${type}&id=${contentId}&season=${season}&episode=${newEpisode}`);
  }

  function handleNextEpisode() {
    const next = String(parseInt(episode) + 1);
    handleEpisodeChange(next);
  }

  function handlePrevEpisode() {
    const prev = Math.max(1, parseInt(episode) - 1);
    handleEpisodeChange(String(prev));
  }

  const embedUrl = buildEmbedUrl();

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <div style={{ padding: "80px 4% 40px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          {/* Back button */}
          <Link
            href="/lab"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            ← Voltar ao Catálogo
          </Link>

          {/* Player */}
          <div
            style={{
              position: "relative",
              width: "100%",
              paddingBottom: "56.25%",
              background: "#111",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <iframe
              src={embedUrl}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: "none",
                pointerEvents: "auto",
                zIndex: 1,
              }}
              frameBorder={0}
              scrolling="no"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture"
            />
          </div>

          {/* Controls for series */}
          {type === "serie" && (
            <div
              style={{
                marginTop: 20,
                padding: 20,
                background: "rgba(24,24,24,0.95)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                    Temporada:
                  </label>
                  <select
                    value={season}
                    onChange={(e) => handleSeasonChange(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(0,0,0,0.5)",
                      color: "#fff",
                      fontSize: 14,
                    }}
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={String(num)}>
                        {num}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                    Episódio:
                  </label>
                  <select
                    value={episode}
                    onChange={(e) => handleEpisodeChange(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(0,0,0,0.5)",
                      color: "#fff",
                      fontSize: 14,
                    }}
                  >
                    {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={String(num)}>
                        {num}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  <button
                    type="button"
                    onClick={handlePrevEpisode}
                    disabled={parseInt(episode) <= 1}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#fff",
                      fontSize: 13,
                      cursor: parseInt(episode) <= 1 ? "not-allowed" : "pointer",
                      opacity: parseInt(episode) <= 1 ? 0.5 : 1,
                    }}
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    onClick={handleNextEpisode}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      background: "#e50914",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Próximo →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
