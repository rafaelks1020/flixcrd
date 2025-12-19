import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface AdminRequestItem {
  id: string;
  title: string;
  type: string;
  imdbId: string | null;
  status: string;
  workflowState: string;
  followersCount: number;
  priorityScore: number | null;
  createdAt: Date;
  updatedAt: Date;
  assignedAdminId: string | null;
  assignedAt: Date | null;
  User: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  AssignedAdmin: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  imdbRating: number | null;
  ageHours: number;
  slaLevel: "LOW" | "MEDIUM" | "HIGH";
  computedPriorityScore: number;
  RequestUpload: {
    id: string;
    titleId: string | null;
    completedAt: Date | null;
    Title: {
      id: string;
      name: string;
      slug: string;
      type: string | null;
    } | null;
  } | null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const minFollowers = searchParams.get("minFollowers");
    const sort = searchParams.get("sort") || "oldest"; // oldest | newest | priority | followers | sla
    const linkFilter = searchParams.get("upload"); // with | without
    const assignedFilter = searchParams.get("assigned"); // me | unassigned

    const where: any = {};

    if (type) {
      where.type = type.toUpperCase();
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) {
          where.createdAt.gte = fromDate;
        }
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) {
          where.createdAt.lte = toDate;
        }
      }
    }

    if (minFollowers) {
      const min = Number(minFollowers);
      if (Number.isFinite(min)) {
        where.followersCount = { gte: min };
      }
    }

    if (assignedFilter === "me") {
      const adminId = (session.user as any).id as string | undefined;
      if (adminId) {
        where.assignedAdminId = adminId;
      }
    } else if (assignedFilter === "unassigned") {
      where.assignedAdminId = null;
    }

    let orderBy: any = { createdAt: "asc" }; // padrão: mais antiga primeiro

    if (sort === "newest") {
      orderBy = { createdAt: "desc" };
    } else if (sort === "priority") {
      orderBy = { priorityScore: "desc" };
    } else if (sort === "followers") {
      orderBy = { followersCount: "desc" };
    }

    if (linkFilter === "with") {
      where.upload = { isNot: null };
    } else if (linkFilter === "without") {
      where.upload = { is: null };
    }

    const requests = await prisma.request.findMany({
      where,
      orderBy,
      take: 200,
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        RequestUpload: {
          select: {
            id: true,
            titleId: true,
            completedAt: true,
            Title: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
              },
            },
          },
        },
        AssignedAdmin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    const now = new Date();

    type RequestWithRelations = (typeof requests)[number];

    const items: AdminRequestItem[] = requests.map((req: RequestWithRelations) => {
      const ageMs = now.getTime() - req.createdAt.getTime();
      const ageHours = ageMs / (1000 * 60 * 60);

      let imdbRating: number | null = null;
      if (req.imdbJson && typeof req.imdbJson === "object") {
        const json: any = req.imdbJson;
        const raw = json.imdbRating ?? json.imdb_rating ?? json.rating;
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) {
          imdbRating = parsed;
        }
      }

      // Cálculo simples de SLA: baixo < 24h, médio < 72h, alto >= 72h
      let slaLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
      if (ageHours >= 72) {
        slaLevel = "HIGH";
      } else if (ageHours >= 24) {
        slaLevel = "MEDIUM";
      }

      // Cálculo de priorização automática (seguidores + rating + SLA)
      const baseFollowers = (req.followersCount || 0) * 10;
      const ratingScore = (imdbRating || 0) * 2;
      const slaScore = slaLevel === "HIGH" ? 30 : slaLevel === "MEDIUM" ? 10 : 0;

      const computedPriorityScore =
        (req.priorityScore ?? 0) + baseFollowers + ratingScore + slaScore;

      return {
        id: req.id,
        title: req.title,
        type: req.type,
        imdbId: req.imdbId,
        status: req.status,
        workflowState: req.workflowState,
        followersCount: req.followersCount,
        priorityScore: req.priorityScore,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        assignedAdminId: req.assignedAdminId,
        assignedAt: (req as any).assignedAt ?? null,
        User: req.User
          ? {
              id: req.User.id,
              email: req.User.email,
              name: req.User.name,
            }
          : null,
        imdbRating,
        ageHours,
        slaLevel,
        computedPriorityScore,
        RequestUpload: req.RequestUpload
          ? {
              id: req.RequestUpload.id,
              titleId: req.RequestUpload.titleId,
              completedAt: req.RequestUpload.completedAt,
              Title: req.RequestUpload.Title
                ? {
                    id: req.RequestUpload.Title.id,
                    name: req.RequestUpload.Title.name,
                    slug: req.RequestUpload.Title.slug,
                    type: req.RequestUpload.Title.type,
                  }
                : null,
            }
          : null,
        AssignedAdmin: req.AssignedAdmin
          ? {
              id: req.AssignedAdmin.id,
              email: req.AssignedAdmin.email,
              name: req.AssignedAdmin.name,
            }
          : null,
      };
    });

    // Se o sort for "sla" ou "priority", aplicamos sort em memória com base nos campos calculados
    if (sort === "sla") {
      items.sort((a, b) => b.ageHours - a.ageHours); // mais antiga (maior SLA) primeiro
    } else if (sort === "priority") {
      items.sort((a, b) => b.computedPriorityScore - a.computedPriorityScore);
    }

    return NextResponse.json({
      items,
      total: items.length,
    });
  } catch (error) {
    console.error("GET /api/admin/solicitacoes error", error);
    return NextResponse.json(
      { error: "Erro ao carregar solicitações." },
      { status: 500 },
    );
  }
}
