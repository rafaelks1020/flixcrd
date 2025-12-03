import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const [titlesCount, titlesWithHlsCount, usersCount, adminsCount] = await Promise.all([
    prisma.title.count(),
    prisma.title.count({ where: { hlsPath: { not: null } } }),
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" as any } }),
  ]);

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
          <p className="mt-1 text-[11px] text-zinc-500">Filmes, séries, animes e outros.</p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase text-zinc-500">Títulos com HLS pronto</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{titlesWithHlsCount}</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Já possuem playlist HLS detectada no Wasabi.
          </p>
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
            Enviar arquivos para o Wasabi e disparar jobs HLS.
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
