"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PremiumNavbar from "@/components/ui/PremiumNavbar";

interface HistoryItem {
  id: string;
  action: string;
  message?: string | null;
  adminId?: string | null;
  createdAt: string;
}

interface RequestDetail {
  id: string;
  title: string;
  type: string;
  imdbId?: string | null;
  imdbJson?: any;
  status: string;
  workflowState: string;
  followersCount: number;
  desiredLanguages?: string | null;
  desiredQuality?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  history: HistoryItem[];
}

interface RequestDetailClientProps {
  id: string;
  isLoggedIn: boolean;
  isAdmin: boolean;
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

function formatAction(action: string) {
  switch (action) {
    case "CREATED":
      return "Solicitação criada";
    case "FOLLOWED":
      return "Novo seguidor";
    case "STATUS_CHANGED":
      return "Status alterado";
    case "WORKFLOW_CHANGED":
      return "Workflow alterado";
    case "ASSIGNED":
      return "Solicitação atribuída";
    case "REJECTED":
      return "Solicitação recusada";
    case "COMPLETED":
      return "Solicitação concluída";
    case "LINKED_TO_CATALOG":
      return "Vinculado ao catálogo";
    case "NOTE_ADDED":
      return "Anotação adicionada";
    default:
      return action;
  }
}

export default function RequestDetailClient({ id, isLoggedIn, isAdmin }: RequestDetailClientProps) {
  const [data, setData] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isLoggedIn]);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`/api/solicitacoes/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setError("Solicitação não encontrada.");
        return;
      }
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error("Erro ao carregar solicitação.");
      }
      const json = await res.json();
      const detail: RequestDetail = {
        ...json,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
        history: (json.history || []).map((h: any) => ({
          ...h,
          createdAt: h.createdAt,
        })),
      };
      setData(detail);
      setError(null);
    } catch (err: any) {
      console.error("Erro ao carregar solicitação:", err);
      setError(err?.message || "Erro ao carregar solicitação.");
    } finally {
      setLoading(false);
    }
  }

  const meta = data?.imdbJson as any | undefined;
  let year: number | null = null;
  if (meta?.releaseDate) {
    const d = new Date(meta.releaseDate);
    if (!Number.isNaN(d.getTime())) year = d.getFullYear();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      <PremiumNavbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "100px 4% 60px" }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            marginBottom: 16,
            fontSize: 13,
            color: "rgba(148,163,184,0.9)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          ← Voltar
        </button>

        {loading ? (
          <p style={{ fontSize: 14, color: "rgba(148,163,184,0.9)" }}>Carregando...</p>
        ) : error ? (
          <p style={{ fontSize: 14, color: "#fecaca" }}>{error}</p>
        ) : !data ? (
          <p style={{ fontSize: 14, color: "rgba(148,163,184,0.9)" }}>
            Solicitação não encontrada.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>
            {/* Coluna esquerda: poster + dados principais */}
            <div>
              <div
                style={{
                  width: "100%",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#111",
                  marginBottom: 12,
                  aspectRatio: "2/3",
                }}
              >
                {meta?.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.posterUrl}
                    alt={data.title}
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
                      fontSize: 48,
                    }}
                  >
                    🎬
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      const url = `flixcrd://requests/${id}`;
                      window.location.href = url;
                    }
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #4b5563",
                    background: "rgba(15,23,42,0.9)",
                    color: "#e5e7eb",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Abrir no app
                </button>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{data.title}</div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: "rgba(148,163,184,0.9)",
                  }}
                >
                  {year && <span>{year} • </span>}
                  <span>
                    {data.type === "MOVIE"
                      ? "Filme"
                      : data.type === "SERIES"
                        ? "Série"
                        : data.type === "ANIME"
                          ? "Anime"
                          : data.type === "DORAMA"
                            ? "Dorama"
                            : data.type}
                  </span>
                </div>
              </div>

              {meta?.overview && (
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(209,213,219,0.9)",
                    lineHeight: 1.5,
                  }}
                >
                  {meta.overview}
                </p>
              )}

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 12,
                  color: "rgba(148,163,184,0.9)",
                }}
              >
                <div>
                  <strong>Status: </strong>
                  {formatStatus(data.status)}
                </div>
                <div>
                  <strong>Workflow: </strong>
                  {formatWorkflow(data.workflowState)}
                </div>
                <div>
                  <strong>Seguidores: </strong>
                  {data.followersCount}
                </div>
                {data.desiredQuality && (
                  <div>
                    <strong>Qualidade desejada: </strong>
                    {data.desiredQuality}
                  </div>
                )}
                {data.desiredLanguages && (
                  <div>
                    <strong>Idiomas desejados: </strong>
                    {String(data.desiredLanguages)}
                  </div>
                )}
                {data.note && (
                  <div>
                    <strong>Observação: </strong>
                    {data.note}
                  </div>
                )}
              </div>

              {/* Painel de ações do admin */}
              {isAdmin && data.status !== "COMPLETED" && data.status !== "REJECTED" && (
                <div
                  style={{
                    marginTop: 20,
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #27272a",
                    background: "rgba(15,23,42,0.8)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Painel do administrador</div>
                  {actionMessage && (
                    <div
                      style={{
                        marginBottom: 8,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(16,185,129,0.15)",
                        color: "#bbf7d0",
                      }}
                    >
                      {actionMessage}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        try {
                          setActionLoading(true);
                          setActionMessage(null);
                          setError(null);
                          const res = await fetch(`/api/admin/solicitacoes/${id}/atribuir`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({}),
                          });
                          if (!res.ok) throw new Error("Erro ao atribuir solicitação.");
                          await load();
                          setActionMessage("Solicitação atribuída ao admin atual.");
                        } catch (err: any) {
                          setError(err?.message || "Erro ao atribuir solicitação.");
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "none",
                        background: "#0ea5e9",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                        opacity: actionLoading ? 0.7 : 1,
                      }}
                    >
                      Assumir caso
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        try {
                          setActionLoading(true);
                          setActionMessage(null);
                          setError(null);
                          const res = await fetch(`/api/admin/solicitacoes/${id}/status`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "UNDER_REVIEW" }),
                          });
                          if (!res.ok) throw new Error("Erro ao alterar status.");
                          await load();
                          setActionMessage("Status alterado para Em análise.");
                        } catch (err: any) {
                          setError(err?.message || "Erro ao alterar status.");
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "none",
                        background: "#facc15",
                        color: "#111827",
                        cursor: "pointer",
                        fontSize: 12,
                        opacity: actionLoading ? 0.7 : 1,
                      }}
                    >
                      Marcar como Em análise
                    </button>

                    <div>
                      <div style={{ marginTop: 4, marginBottom: 4 }}>Recusar solicitação</div>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="Motivo da recusa"
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "#e5e7eb",
                          fontSize: 12,
                          marginBottom: 4,
                        }}
                      />
                      <button
                        type="button"
                        disabled={actionLoading || !rejectReason.trim()}
                        onClick={async () => {
                          if (!rejectReason.trim()) return;
                          try {
                            setActionLoading(true);
                            setActionMessage(null);
                            setError(null);
                            const res = await fetch(`/api/admin/solicitacoes/${id}/recusar`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ reason: rejectReason.trim() }),
                            });
                            if (!res.ok) throw new Error("Erro ao recusar solicitação.");
                            await load();
                            setActionMessage("Solicitação recusada.");
                            setRejectReason("");
                          } catch (err: any) {
                            setError(err?.message || "Erro ao recusar solicitação.");
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: "none",
                          background: "#b91c1c",
                          color: "#fee2e2",
                          cursor: "pointer",
                          fontSize: 12,
                          opacity: actionLoading || !rejectReason.trim() ? 0.6 : 1,
                        }}
                      >
                        Recusar solicitação
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        try {
                          setActionLoading(true);
                          setActionMessage(null);
                          setError(null);
                          const res = await fetch(`/api/admin/solicitacoes/${id}/concluir`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ message: null }),
                          });
                          if (!res.ok) throw new Error("Erro ao concluir solicitação.");
                          await load();
                          setActionMessage("Solicitação marcada como concluída.");
                        } catch (err: any) {
                          setError(err?.message || "Erro ao concluir solicitação.");
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "none",
                        background: "#22c55e",
                        color: "#022c22",
                        cursor: "pointer",
                        fontSize: 12,
                        opacity: actionLoading ? 0.7 : 1,
                      }}
                    >
                      Marcar como Concluída
                    </button>

                    {/* Adicionar ao catálogo via TMDB */}
                    {meta?.tmdbId && meta?.type && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={async () => {
                          try {
                            setActionLoading(true);
                            setActionMessage(null);
                            setError(null);

                            const tmdbId = meta.tmdbId;
                            const type = meta.type;

                            // 1) Criar título (ou reaproveitar existente) via /api/titles
                            const createRes = await fetch("/api/titles", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ tmdbId, type }),
                            });

                            let titleId: string | undefined;
                            let titleName: string | undefined;

                            if (createRes.status === 409) {
                              const dataJson = await createRes.json().catch(() => ({}));
                              titleId = dataJson?.title?.id;
                              titleName = dataJson?.title?.name;
                            } else {
                              if (!createRes.ok) {
                                const dataJson = await createRes.json().catch(() => ({}));
                                throw new Error(dataJson?.error || "Erro ao criar título no catálogo.");
                              }
                              const dataJson = await createRes.json();
                              titleId = dataJson?.id;
                              titleName = dataJson?.name;
                            }

                            if (!titleId) {
                              throw new Error("Não foi possível obter o ID do título criado.");
                            }

                            // 2) Vincular solicitação ao título via /api/admin/solicitacoes/[id]/upload (em background)
                            //    Não bloqueia o redirecionamento; se falhar, será apenas logado no servidor.
                            // eslint-disable-next-line @typescript-eslint/no-floating-promises
                            fetch(`/api/admin/solicitacoes/${id}/upload`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                titleId,
                                completedAt: new Date().toISOString(),
                              }),
                            }).catch((err) => {
                              // eslint-disable-next-line no-console
                              console.error("Erro ao vincular solicitação ao catálogo:", err);
                            });

                            // Redirecionar direto para o Upload Unificado, já com o título selecionado
                            const params = new URLSearchParams({
                              titleId,
                              requestId: id,
                            });
                            if (typeof window !== "undefined") {
                              window.location.href = `/admin/upload-v2?${params.toString()}`;
                            } else {
                              router.push(`/admin/upload-v2?${params.toString()}`);
                            }
                            return;
                          } catch (err: any) {
                            console.error("Erro ao adicionar ao catálogo:", err);
                            setError(err?.message || "Erro ao adicionar ao catálogo.");
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        style={{
                          marginTop: 4,
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: "none",
                          background: "#6366f1",
                          color: "#e5e7eb",
                          cursor: "pointer",
                          fontSize: 12,
                          opacity: actionLoading ? 0.7 : 1,
                        }}
                      >
                        Atender / Adicionar ao Catálogo (TMDB)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Coluna direita: timeline/histórico */}
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                Linha do tempo
              </h2>

              {data.history.length === 0 ? (
                <p style={{ fontSize: 13, color: "rgba(148,163,184,0.9)" }}>
                  Nenhum evento registrado ainda.
                </p>
              ) : (
                <ol
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    borderLeft: "1px solid #27272a",
                    paddingLeft: 16,
                  }}
                >
                  {data.history.map((h) => {
                    const date = new Date(h.createdAt);
                    const dateStr = date.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });
                    const timeStr = date.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <li key={h.id} style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            position: "relative",
                            marginLeft: -17,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              left: -6,
                              top: 6,
                              width: 10,
                              height: 10,
                              borderRadius: "999px",
                              background: "#e50914",
                            }}
                          />
                          <div
                            style={{
                              marginLeft: 16,
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {formatAction(h.action)}
                          </div>
                        </div>
                        <div
                          style={{
                            marginLeft: 16,
                            fontSize: 12,
                            color: "rgba(148,163,184,0.9)",
                          }}
                        >
                          <div>
                            {dateStr} às {timeStr}
                          </div>
                          {h.message && <div>{h.message}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
