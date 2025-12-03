import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

import { POST as importSeasonPost } from "../import-season/route";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TMDB_API_KEY não configurado." },
        { status: 500 },
      );
    }

    const { id } = await context.params;

    const title = await prisma.title.findUnique({
      where: { id },
      select: {
        id: true,
        tmdbId: true,
        type: true,
      },
    });

    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    if (!title.tmdbId) {
      return NextResponse.json(
        { error: "Título não possui tmdbId configurado." },
        { status: 400 },
      );
    }

    // Busca temporadas conhecidas no TMDB para esse título
    const url = new URL(`${TMDB_BASE_URL}/tv/${title.tmdbId}?language=pt-BR`);
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("TMDB all seasons error", res.status, text);
      return NextResponse.json(
        { error: "Erro ao buscar temporadas no TMDB." },
        { status: 500 },
      );
    }

    const data: any = await res.json();

    const seasons = Array.isArray(data.seasons) ? data.seasons : [];
    const seasonNumbers = seasons
      .map((s: any) => s.season_number as number)
      .filter((n: number) => Number.isFinite(n) && n > 0);

    const imported: number[] = [];
    const errors: { seasonNumber: number; message: string }[] = [];

    for (const seasonNumber of seasonNumbers) {
      try {
        const fakeRequest = new NextRequest("http://localhost", {
          method: "POST",
          body: JSON.stringify({ seasonNumber }),
        } as any);

        const result = await importSeasonPost(fakeRequest, {
          params: Promise.resolve({ id }),
        } as RouteContext);

        if (result.ok) {
          imported.push(seasonNumber);
        } else {
          const json = await result.json().catch(() => ({}));
          errors.push({
            seasonNumber,
            message: json?.error || `Erro HTTP ${result.status}`,
          });
        }
      } catch (err: any) {
        errors.push({
          seasonNumber,
          message: err?.message || "Erro desconhecido ao importar temporada.",
        });
      }
    }

    return NextResponse.json({
      seasonsFound: seasonNumbers.length,
      imported,
      errors,
    });
  } catch (error: any) {
    console.error(
      "POST /api/admin/titles/[id]/import-all-seasons error",
      error,
    );
    return NextResponse.json(
      { error: error?.message || "Erro ao importar todas as temporadas." },
      { status: 500 },
    );
  }
}
