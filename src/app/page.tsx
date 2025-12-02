import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-50">
      <div className="w-full max-w-xl space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">FlixCRD</h1>
        <p className="text-sm text-zinc-400">
          Plataforma de streaming em construção. Acesse o painel administrativo para gerenciar
          catálogo, uploads HLS e assinaturas.
        </p>
        <div className="flex justify-center">
          <Link
            href="/login"
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
          >
            Ir para login
          </Link>
        </div>
      </div>
    </main>
  );
}
