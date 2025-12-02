"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@flixcrd.local");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadBackground() {
      try {
        const res = await fetch("/api/titles");
        const json = await res.json();

        if (!Array.isArray(json) || json.length === 0) return;

        const withBackdrop = json.find((t: any) => t.backdropUrl) ?? json[0];
        const url = withBackdrop.backdropUrl || withBackdrop.posterUrl;
        if (typeof url === "string" && url.length > 0) {
          setBgUrl(url);
        }
      } catch {
        // se falhar, mantemos o fundo preto
      }
    }

    loadBackground();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result && !result.error) {
      router.push("/");
      router.refresh();
      return;
    }

    setFormError("Credenciais inválidas. Verifique email e senha.");
  }

  return (
    <div className="relative min-h-screen bg-black text-zinc-50">
      {bgUrl && (
        <div className="pointer-events-none absolute inset-0">
          <img
            src={bgUrl}
            alt="Plano de fundo de títulos"
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />
        </div>
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-4 py-4 text-sm text-zinc-200 md:px-10">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            FlixCRD
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-4 md:justify-end md:px-10">
          <div className="w-full max-w-md rounded-xl border border-zinc-800/80 bg-black/80 p-8 shadow-2xl">
            <h1 className="mb-6 text-2xl font-semibold text-zinc-50 text-center">
              Entrar
            </h1>

            {formError && (
              <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-200" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none ring-0 focus:border-zinc-500"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-200" htmlFor="password">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none ring-0 focus:border-zinc-500"
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white disabled:opacity-70"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              <p className="mt-4 text-xs text-zinc-500 text-center">
                Admin padrão: <span className="font-mono">admin@flixcrd.local</span> / <span className="font-mono">admin123</span>
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
