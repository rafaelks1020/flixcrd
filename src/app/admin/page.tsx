import Link from "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatsCard from "@/components/admin/StatsCard";
import AnimatedCounter from "@/components/admin/AnimatedCounter";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const [
    titlesCount,
    titlesWithHlsCount,
    usersCount,
    adminsCount,
    moviesCount,
    seriesCount,
    animesCount,
    recentTitles,
  ] = await Promise.all([
    prisma.title.count(),
    prisma.title.count({ where: { hlsPath: { not: null } } }),
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" as any } }),
    prisma.title.count({ where: { type: "MOVIE" } }),
    prisma.title.count({ where: { type: "SERIES" } }),
    prisma.title.count({ where: { type: "ANIME" } }),
    prisma.title.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        posterUrl: true,
        createdAt: true,
      },
    }),
  ]);

  const hlsPercentage = titlesCount > 0 ? Math.round((titlesWithHlsCount / titlesCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-zinc-400 text-sm">
          Visão geral rápida do catálogo, usuários e fluxo de HLS. Use os atalhos abaixo para ir direto
          para as principais telas do painel.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Títulos no catálogo</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-50">{titlesCount}</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {moviesCount} filmes · {seriesCount} séries · {animesCount} animes
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Títulos com HLS pronto</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{titlesWithHlsCount}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${hlsPercentage}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">{hlsPercentage}% do catálogo</p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Usuários</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-50">{usersCount}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Contas com acesso à plataforma.</p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Admins</p>
          <p className="mt-2 text-3xl font-semibold text-sky-300">{adminsCount}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Podem gerenciar catálogo e HLS.</p>
        </div>
      </div>

      {/* Últimos Títulos Adicionados */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h3 className="text-sm font-semibold mb-3">📺 Últimos Títulos Adicionados</h3>
        {recentTitles.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum título cadastrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {recentTitles.map((title) => (
              <div
                key={title.id}
                className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-2"
              >
                {title.posterUrl ? (
                  <img
                    src={title.posterUrl}
                    alt={title.name}
                    className="h-12 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-8 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">
                    N/A
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 truncate">{title.name}</p>
                  <p className="text-[10px] text-zinc-500">
                    {title.type} · {new Date(title.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Link
          href="/admin/catalog"
          className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900/80"
        >
          <p className="font-semibold">Catálogo</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Buscar no TMDB, criar títulos e gerenciar metadados.
          </p>
        </Link>

        <Link
          href="/admin/upload"
          className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900/80"
        >
          <p className="font-semibold">Upload / HLS</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Enviar arquivos para o B2 e disparar jobs HLS.
          </p>
        </Link>

        <Link
          href="/admin/jobs"
          className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900/80"
        >
          <p className="font-semibold">Jobs HLS</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Acompanhar fila de transcodificação e progresso dos jobs.
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900/80"
        >
          <p className="font-semibold">Usuários</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Criar contas, gerenciar roles e senhas.
          </p>
        </Link>
      </div>
    </div>
  );
}
