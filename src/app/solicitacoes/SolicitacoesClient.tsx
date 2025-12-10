"use client";

import { useEffect, useState } from "react";
import PremiumNavbar from "@/components/ui/PremiumNavbar";
import Link from "next/link";

interface RequestItem {
  id: string;
  title: string;
  type: string;
  imdbId?: string | null;
  status: string;
  workflowState: string;
  followersCount: number;
  desiredLanguages?: string | null;
  desiredQuality?: string | null;
  note?: string | null;
  imdbJson?: any;
  createdAt?: string;
  updatedAt?: string;
}

interface TmdbResult {
  tmdbId: number;
  type: string; // MOVIE | SERIES
  name: string;
  originalName?: string | null;
  overview: string;
  releaseDate?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
}

interface SolicitacoesClientProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export default function SolicitacoesClient({ isLoggedIn, isAdmin }: SolicitacoesClientProps) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const [mode, setMode] = useState<"tmdb" | "manual">("tmdb");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<TmdbResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TmdbResult | null>(null);
  const [tmdbSearched, setTmdbSearched] = useState(false);

  const [titleInput, setTitleInput] = useState("");
  const [type, setType] = useState<string>("MOVIE");
  const [languages, setLanguages] = useState<string[]>(["legendado"]);
  const [quality, setQuality] = useState<string>("1080p");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadRequests();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!error && !success) return;

    const timeout = setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 6000);

    return () => clearTimeout(timeout);
  }, [error, success]);

  async function loadRequests() {
    try {
      setLoadingRequests(true);
      const res = await fetch("/api/solicitacoes", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Erro ao carregar solicitações");
      }

      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error("Erro ao carregar solicitações:", err);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function handleSearchTmdb(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearchLoading(true);
      setError(null);
      const params = new URLSearchParams({ q: searchQuery.trim(), type: "multi" });
      const res = await fetch(`/api/tmdb/search?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Erro ao buscar no TMDB");
      }
      const data = await res.json();
      const results: TmdbResult[] = data.results ?? [];
      setSearchResults(results);
      // Após qualquer busca, habilita a opção de solicitação manual
      // (usuário pode ter visto os resultados e mesmo assim não ter encontrado o que queria)
      setTmdbSearched(true);
    } catch (err) {
      console.error("Erro na busca TMDB:", err);
      setError("Erro ao buscar títulos. Tente novamente.");
      // Em caso de erro, também permitimos solicitação manual
      setTmdbSearched(true);
    } finally {
      setSearchLoading(false);
    }
  }

  function toggleLanguage(value: string) {
    setLanguages((prev) =>
      prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);

    const finalTitle = (selectedResult?.name || titleInput).trim();
    if (!finalTitle) {
      setError("Informe um título.");
      return;
    }

    const body: any = {
      title: finalTitle,
      type,
      desiredLanguages: languages,
      desiredQuality: quality,
      note: note.trim() || null,
    };

    if (mode === "tmdb" && selectedResult) {
      // Usar tmdbId como identificador estável neste contexto
      body.imdbId = String(selectedResult.tmdbId);
      body.imdbJson = selectedResult;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        // Já existe uma solicitação para esse conteúdo.
        const data = await res.json().catch(() => ({}));
        const existingId = data?.requestId as string | undefined;

        if (existingId) {
          try {
            const followRes = await fetch(`/api/solicitacoes/${existingId}/seguir`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });

            if (!followRes.ok) {
              throw new Error("Erro ao seguir solicitação existente.");
            }

            await loadRequests();
            setSuccess(
              "Já existe uma solicitação para esse conteúdo. Você agora está seguindo e receberá notificações dessa solicitação.",
            );
            setError(null);
          } catch (followError: any) {
            console.error("Erro ao seguir solicitação existente:", followError);
            setError(
              followError?.message ||
                "Já existe uma solicitação para esse conteúdo e não foi possível segui-la.",
            );
          }
        } else {
          setError(
            "Já existe uma solicitação para esse conteúdo.",
          );
        }
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        if (res.status === 429) {
          throw new Error(
            data?.error ||
              "Você acabou de criar uma solicitação. Aguarde alguns segundos antes de enviar outra.",
          );
        }

        if (res.status === 400 && typeof data?.error === "string") {
          if (data.error.includes("Limite de solicitações ativas")) {
            throw new Error(
              "Você já tem o número máximo de solicitações ativas. Aguarde alguma ser concluída ou recusada antes de criar outra.",
            );
          }
        }

        throw new Error(data.error || "Erro ao criar solicitação");
      }

      const created: RequestItem = await res.json();
      setRequests((prev) => [created, ...prev]);
      setSuccess("Solicitação criada com sucesso! Você receberá notificações quando houver progresso.");

      // Reset parcial do formulário
      setNote("");
      if (mode === "manual") {
        setTitleInput("");
      }
    } catch (err) {
      console.error("Erro ao criar solicitação:", err);
      setError(err instanceof Error ? err.message : "Erro ao criar solicitação.");
    } finally {
      setSubmitting(false);
    }
  }

  function formatStatus(status: string) {
    switch (status) {
      case "PENDING":
        return "Pendente";
      case "UNDER_REVIEW":
        return "Em análise";
      case "IN_PRODUCTION":
        return "Em produção";
      case "UPLOADING":
        return "Upload";
      case "COMPLETED":
        return "Concluída";
      case "REJECTED":
        return "Recusada";
      default:
        return status;
    }
  }

  function formatWorkflow(state: string) {
    switch (state) {
      case "TECH_ANALYSIS":
        return "Análise técnica";
      case "SOURCE_ACQUISITION":
        return "Obtendo fonte";
      case "ENCODING":
        return "Encoding";
      case "SUBTITLING":
        return "Legendagem";
      case "UPLOAD_SERVER":
        return "Upload servidor";
      case "PUBLISHED":
        return "Publicado";
      case "NONE":
      default:
        return "Sem workflow";
    }
  }

  const typedSearchResults = searchResults as any[];

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <div style={{ maxWidth: "1360px", margin: "0 auto", padding: "100px 4% 60px" }}>
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 700, marginBottom: 24 }}>
          Solicitações de Conteúdo
        </h1>

        <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 32, maxWidth: 700 }}>
          Peça novos filmes, séries, animes ou doramas para serem adicionados à plataforma.
          Você pode buscar por títulos existentes no TMDB ou criar uma solicitação manual
          quando não encontrar o que procura.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
            columnGap: 40,
            alignItems: "flex-start",
          }}
        >
          {/* Formulário de criação */}
          <div
            style={{
              background: "rgba(18,18,18,0.95)",
              borderRadius: 8,
              border: "1px solid #262626",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 16,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <button
                type="button"
                onClick={() => setMode("tmdb")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  background:
                    mode === "tmdb" ? "#e50914" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                }}
              >
                Buscar no TMDB
              </button>

              {tmdbSearched && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("manual");
                    setSelectedResult(null);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #4b5563",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    background:
                      mode === "manual" ? "#e50914" : "rgba(15,23,42,0.9)",
                    color: "#fff",
                    whiteSpace: "nowrap",
                  }}
                >
                  Não encontrei / Solicitação manual
                </button>
              )}
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(239,68,68,0.12)",
                  color: "#fecaca",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(34,197,94,0.15)",
                  color: "#bbf7d0",
                  fontSize: 13,
                }}
              >
                {success}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mode === "tmdb" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
                    Buscar título
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleSearchTmdb();
                        }
                      }}
                      placeholder="Digite o nome do filme, série, anime..."
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #333",
                        background: "#111",
                        color: "#fff",
                        fontSize: 13,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleSearchTmdb();
                      }}
                      disabled={searchLoading}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "none",
                        background: "#e50914",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        opacity: searchLoading ? 0.7 : 1,
                      }}
                    >
                      {searchLoading ? "Buscando..." : "Buscar"}
                    </button>
                  </div>

                  {typedSearchResults.length > 0 && !selectedResult && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {typedSearchResults.map((item) => {
                        const year = item.releaseDate
                          ? new Date(item.releaseDate).getFullYear()
                          : null;
                        return (
                          <button
                            key={`${item.type}-${item.tmdbId}`}
                            type="button"
                            onClick={() => {
                              setSelectedResult(item);
                              setTitleInput(item.name);
                              setType(item.type || "MOVIE");
                            }}
                            style={{
                              textAlign: "left",
                              background: "#18181b",
                              border: "1px solid #27272a",
                              borderRadius: 8,
                              padding: 8,
                              display: "flex",
                              gap: 8,
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                width: 40,
                                height: 60,
                                borderRadius: 4,
                                overflow: "hidden",
                                background: "#111",
                                flexShrink: 0,
                              }}
                            >
                              {item.posterUrl ? (
                                 
                                <img
                                  src={item.posterUrl}
                                  alt={item.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 18,
                                  }}
                                >
                                  🎬
                                </div>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 500,
                                  marginBottom: 2,
                                  overflow: "hidden",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                }}
                              >
                                {item.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "rgba(255,255,255,0.6)",
                                  marginBottom: 4,
                                }}
                              >
                                {year && <span>{year} • </span>}
                                <span>{item.type === "MOVIE" ? "Filme" : "Série"}</span>
                              </div>
                              {item.overview && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "rgba(255,255,255,0.6)",
                                    marginTop: 2,
                                    maxHeight: 48,
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: "vertical",
                                  }}
                                >
                                  {item.overview}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedResult && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 8,
                        borderRadius: 8,
                        border: "1px solid #27272a",
                        background: "#111827",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 60,
                          borderRadius: 4,
                          overflow: "hidden",
                          background: "#111",
                          flexShrink: 0,
                        }}
                      >
                        {selectedResult.posterUrl ? (
                           
                          <img
                            src={selectedResult.posterUrl}
                            alt={selectedResult.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 18,
                            }}
                          >
                            🎬
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            marginBottom: 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {selectedResult.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.6)",
                          }}
                        >
                          {selectedResult.releaseDate && (
                            <span>
                              {new Date(selectedResult.releaseDate).getFullYear()} • {" "}
                            </span>
                          )}
                          <span>{selectedResult.type === "MOVIE" ? "Filme" : "Série"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  Título
                </label>
                <input
                  type="text"
                  value={selectedResult ? selectedResult.name : titleInput}
                  onChange={(e) => {
                    setSelectedResult(null);
                    setTitleInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="Nome do conteúdo a ser solicitado"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #333",
                    background: "#111",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                    Tipo
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #333",
                      background: "#111",
                      color: "#fff",
                      fontSize: 13,
                    }}
                  >
                    <option value="MOVIE">Filme</option>
                    <option value="SERIES">Série</option>
                    <option value="ANIME">Anime</option>
                    <option value="DORAMA">Dorama</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                    Qualidade desejada
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #333",
                      background: "#111",
                      color: "#fff",
                      fontSize: 13,
                    }}
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  Idiomas desejados
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[{ value: "dublado", label: "Dublado" }, { value: "legendado", label: "Legendado" }, { value: "original", label: "Áudio original" }].map(
                    (opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleLanguage(opt.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: languages.includes(opt.value)
                            ? "1px solid #e50914"
                            : "1px solid #333",
                          background: languages.includes(opt.value)
                            ? "rgba(229,9,20,0.15)"
                            : "#111",
                          color: "#fff",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {opt.label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  Observação (opcional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Ex: Versão dublada em português, se possível."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #333",
                    background: "#111",
                    color: "#fff",
                    fontSize: 13,
                    resize: "vertical",
                  }}
                />
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  void handleSubmit();
                }}
                style={{
                  marginTop: 4,
                  padding: "10px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#e50914",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Enviando..." : "Enviar solicitação"}
              </button>
            </div>
          </div>

          {/* Listagem de solicitações */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
              Minhas solicitações
            </h2>

            {loadingRequests ? (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
                Carregando solicitações...
              </p>
            ) : requests.length === 0 ? (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
                Você ainda não fez nenhuma solicitação.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {requests.map((req) => {
                  let year: number | null = null;
                  if (req.imdbJson && typeof req.imdbJson === "object") {
                    const anyJson: any = req.imdbJson;
                    if (anyJson.releaseDate) {
                      const d = new Date(anyJson.releaseDate);
                      if (!Number.isNaN(d.getTime())) {
                        year = d.getFullYear();
                      }
                    }
                  }

                  return (
                    <div
                      key={req.id}
                      style={{
                        borderRadius: 8,
                        border: "1px solid #27272a",
                        background: "rgba(18,18,18,0.95)",
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 500 }}>
                            <Link
                              href={`/solicitacao/${req.id}`}
                              style={{
                                color: "#fff",
                                textDecoration: "none",
                              }}
                            >
                              {req.title}
                            </Link>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(255,255,255,0.6)",
                              marginTop: 2,
                            }}
                          >
                            {year && <span>{year} • </span>}
                            <span>
                              {req.type === "MOVIE"
                                ? "Filme"
                                : req.type === "SERIES"
                                  ? "Série"
                                  : req.type === "ANIME"
                                    ? "Anime"
                                    : req.type === "DORAMA"
                                      ? "Dorama"
                                      : req.type}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: 12 }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                background:
                                  req.status === "COMPLETED"
                                    ? "rgba(34,197,94,0.15)"
                                    : req.status === "REJECTED"
                                      ? "rgba(239,68,68,0.15)"
                                      : "rgba(250,204,21,0.12)",
                              }}
                            >
                              {formatStatus(req.status)}
                            </span>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                background: "rgba(148,163,184,0.15)",
                              }}
                            >
                              {formatWorkflow(req.workflowState)}
                            </span>
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              color: "rgba(148,163,184,0.9)",
                            }}
                          >
                            {req.followersCount} seguidor
                            {req.followersCount !== 1 ? "es" : ""}
                          </div>
                        </div>
                      </div>

                      {req.note && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: "rgba(209,213,219,0.9)",
                          }}
                        >
                          <span style={{ opacity: 0.7 }}>Obs:</span> {req.note}
                        </div>
                      )}

                      {(req.desiredLanguages || req.desiredQuality) && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "rgba(148,163,184,0.9)",
                          }}
                        >
                          {req.desiredLanguages && (
                            <span>
                              Idiomas: {String(req.desiredLanguages)}
                            </span>
                          )}
                          {req.desiredLanguages && req.desiredQuality && " • "}
                          {req.desiredQuality && <span>Qualidade: {req.desiredQuality}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
