export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <span className="text-lg font-semibold text-red-500">P</span>
        </div>
        <h1 className="text-2xl font-bold">Você está offline</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Sem internet no momento. Assim que a conexão voltar, tente novamente.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <a
            href="/"
            className="w-full rounded-lg bg-red-600 hover:bg-red-700 transition-colors px-4 py-3 font-semibold"
          >
            Voltar para o início
          </a>
          <a
            href="/offline"
            className="w-full rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors border border-zinc-800 px-4 py-3 font-semibold"
          >
            Tentar novamente
          </a>
        </div>
        <p className="mt-6 text-xs text-zinc-500">
          Dica: no iPhone, instale o PWA em “Compartilhar” → “Adicionar à Tela de Início”.
        </p>
      </div>
    </main>
  );
}
