import Link from "next/link";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function getYear(date: Date | null): string | null {
  if (!date) return null;
  return String(date.getFullYear());
}

export default async function Home() {
  let session: any = null;

  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.error("Erro ao obter sessão na Home (tratado como visitante)", err);
    session = null;
  }

  const titles = await prisma.title.findMany({
    orderBy: { createdAt: "desc" },
  });

  type TitleItem = (typeof titles)[number];

  if (titles.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-4 text-zinc-50">
        <div className="w-full max-w-xl space-y-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">FlixCRD</h1>
          <p className="text-sm text-zinc-400">
            Nenhum título disponível ainda. Acesse o painel administrativo para começar a montar o
            catálogo.
          </p>
          <div className="flex justify-center gap-3 text-sm">
            <Link
              href="/login"
              className="rounded-md bg-zinc-100 px-4 py-2 font-semibold text-zinc-950 hover:bg-white"
            >
              Ir para login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [hero, ...rest] = titles;
  const others = rest.length > 0 ? rest : titles;

  const heroYear = getYear(hero.releaseDate);
  const heroBackdrop =
    hero.backdropUrl ||
    others.find((t: TitleItem) => t.backdropUrl)?.backdropUrl ||
    null;

  return (
    <main className="min-h-screen bg-black text-zinc-50">
      <section className="relative min-h-[80vh] overflow-hidden bg-black">
        {heroBackdrop && (
          <div className="absolute inset-0">
            <img
              src={heroBackdrop}
              alt={hero.name}
              className="h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/20" />
          </div>
        )}

        <div className="relative z-10 flex min-h-[80vh] flex-col">
          <header className="flex items-center justify-between px-4 py-4 text-sm text-zinc-200 md:px-10">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold tracking-tight">FlixCRD</span>
              {heroYear && (
                <span className="rounded-full border border-zinc-600/70 px-2 py-0.5 text-[10px] uppercase text-zinc-300">
                  Beta
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {session && session.user?.email === "admin@flixcrd.local" && (
                <Link
                  href="/admin"
                  className="hidden rounded-md border border-zinc-500/80 px-3 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-800/80 md:inline-block"
                >
                  Painel admin
                </Link>
              )}
              {!session && (
                <Link
                  href="/login"
                  className="rounded-md bg-zinc-50 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-white md:text-sm"
                >
                  Entrar
                </Link>
              )}
            </div>
          </header>

          <div className="flex flex-1 items-center justify-center px-4 pb-10 pt-4 md:justify-start md:px-10">
            <div className="max-w-2xl space-y-5 text-center md:text-left">
              <h1 className="text-3xl font-extrabold tracking-tight drop-shadow-lg md:text-5xl">
                Filmes, séries e muito mais,
                <br /> sem limites.
              </h1>
              <p className="text-sm text-zinc-200 md:text-base">
                Assista onde quiser. Em breve: planos de assinatura, perfis e muito mais – tudo no
                FlixCRD.
              </p>
              <p className="text-xs text-zinc-300 md:text-sm">
                Pronto para assistir? Entre na sua conta de administrador para gerenciar o catálogo
                ou explorar os títulos disponíveis.
              </p>
              <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center md:justify-start">
                {session ? (
                  <>
                    <Link
                      href={`/title/${hero.id}`}
                      className="w-full max-w-xs rounded-md bg-zinc-50 px-4 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-white sm:w-auto"
                    >
                      Assistir
                    </Link>
                    <Link
                      href="#catalogo"
                      className="w-full max-w-xs rounded-md border border-zinc-500/80 px-4 py-2 text-center text-sm font-semibold text-zinc-100 hover:bg-zinc-800/80 sm:w-auto"
                    >
                      Ver catálogo
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="w-full max-w-xs rounded-md bg-zinc-50 px-4 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-white sm:w-auto"
                  >
                    Entrar
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {session && (
        <section
          id="catalogo"
          className="mx-auto max-w-6xl px-4 pb-10 pt-6 md:px-8"
        >
          <h2 className="mb-4 text-lg font-semibold md:text-xl">Catálogo FlixCRD</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {others.map((title: TitleItem) => {
              const year = getYear(title.releaseDate);
              return (
                <Link
                  key={title.id}
                  href={`/title/${title.id}`}
                  className="group relative overflow-hidden rounded-md bg-zinc-900/80 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  {title.posterUrl ? (
                    <img
                      src={title.posterUrl}
                      alt={title.name}
                      className="aspect-[2/3] w-full object-cover transition group-hover:opacity-80"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-800 text-center text-xs text-zinc-300">
                      {title.name}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2 text-[11px] leading-tight">
                    <div className="line-clamp-2 font-semibold text-zinc-50">
                      {title.name}
                    </div>
                    {year && <div className="text-[10px] text-zinc-300">{year}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
