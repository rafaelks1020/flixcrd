import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

function getYear(date: Date | null): string | null {
  if (!date) return null;
  return String(date.getFullYear());
}

export default async function TitleDetailPage({ params }: PageProps) {
  const { id } = await params;

  const title = await prisma.title.findUnique({ where: { id } });

  if (!title) {
    notFound();
  }

  const year = getYear(title.releaseDate as Date | null);

  const typeLabel =
    title.type === "MOVIE"
      ? "Filme"
      : title.type === "SERIES"
      ? "Série"
      : title.type === "ANIME"
      ? "Anime"
      : "Outro";

  return (
    <main className="min-h-screen bg-black text-zinc-50">
      <div className="relative min-h-screen bg-black">
        {title.backdropUrl && (
          <div className="pointer-events-none absolute inset-0">
            <img
              src={title.backdropUrl}
              alt={title.name}
              className="h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/40" />
          </div>
        )}

        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="flex items-center justify-between px-4 py-4 text-sm text-zinc-200 md:px-10">
            <Link href="/" className="font-semibold tracking-tight">
              FlixCRD
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-zinc-500/70 px-3 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-800/80"
            >
              Entrar
            </Link>
          </header>

          <section className="flex flex-1 flex-col items-center px-4 pb-10 pt-2 md:flex-row md:items-stretch md:px-10 md:pb-16 md:pt-4">
            <div className="mb-6 w-full max-w-xs md:mb-0 md:w-auto md:max-w-sm">
              {title.posterUrl ? (
                <div className="overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900/80 shadow-2xl">
                  <img
                    src={title.posterUrl}
                    alt={title.name}
                    className="aspect-[2/3] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[2/3] items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-900/80 text-center text-sm text-zinc-300 shadow-2xl">
                  {title.name}
                </div>
              )}
            </div>

            <div className="w-full max-w-2xl space-y-4 md:ml-10">
              <div>
                <h1 className="text-2xl font-semibold md:text-3xl">
                  {title.name}
                  {year && <span className="ml-2 text-zinc-300">({year})</span>}
                </h1>
                {title.originalName && title.originalName !== title.name && (
                  <p className="mt-1 text-sm text-zinc-400">{title.originalName}</p>
                )}
                <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400">{typeLabel}</p>
              </div>

              <div className="text-sm leading-relaxed text-zinc-100">
                {title.overview || "Sem sinopse cadastrada para este título."}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Link
                  href={`/watch/${title.id}`}
                  className="rounded-md bg-zinc-50 px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
                >
                  Assistir agora
                </Link>

                <Link
                  href="/"
                  className="rounded-md border border-zinc-600/80 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800/80"
                >
                  Voltar para início
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
