import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Novidades",
};

interface ChangelogItem {
  title: string;
  description: string;
}

interface ChangelogSection {
  heading: string;
  items: ChangelogItem[];
}

interface ChangelogEntry {
  date: string;
  title: string;
  highlight?: string;
  image?: {
    src: string;
    alt: string;
  };
  sections: ChangelogSection[];
}

const entries: ChangelogEntry[] = [
  {
    date: "2025-12-09",
    title: "Legendas reais, melhorias de player e estabilidade de vídeo",
    highlight: "Legendas & Upload v2",
    // Opcional: adicionar screenshot em /public/changelog/...
    // image: { src: "/changelog/legendagem-2025-12-09.png", alt: "Exemplo de seleção de legenda no player" },
    sections: [
      {
        heading: "Novidades",
        items: [
          {
            title: "Legendas reais no player web",
            description:
              "Quando um filme ou episódio tem legendas salvas em .vtt, o player agora mostra opções de legenda na interface, usando as faixas enviadas pelo backend.",
          },
          {
            title: "Playback com subtitles[] estruturado",
            description:
              "As rotas de playback passaram a enviar um array subtitles[] com as faixas de legenda disponíveis, e a página /watch/[id] cria as trilhas de legenda automaticamente.",
          },
        ],
      },
      {
        heading: "Melhorias de estabilidade",
        items: [
          {
            title: "Transcodificação mais compatível",
            description:
              "O pipeline HLS foi ajustado para forçar saída em 8-bit (yuv420p), evitando erros com fontes 10-bit e aumentando a compatibilidade com navegadores e TVs.",
          },
        ],
      },
      {
        heading: "Bastidores (impacto indireto)",
        items: [
          {
            title: "Admin com fluxo de legendas automatizado",
            description:
              "O painel admin ganhou fluxo para buscar, baixar e anexar legendas direto no storage, reduzindo trabalho manual e diminuindo chance de episódios sem legenda.",
          },
          {
            title: "Upload v2 com ajuda de IA",
            description:
              "O upload v2 passou a usar IA para ajudar a detectar temporada/episódio a partir do nome do arquivo, acelerando a organização de séries e animes.",
          },
        ],
      },
    ],
  },
];

export default function PublicChangelogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-3 border-b border-zinc-900 pb-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-700/60 bg-emerald-900/30 px-3 py-1 text-[11px] font-medium text-emerald-300">
            <span>🚀</span>
            <span>Atualizações do Pflix</span>
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Novidades para quem assiste</h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Aqui você acompanha, em linguagem simples, o que mudou recentemente na plataforma: melhorias
            de legenda, player, estabilidade de vídeo e bastidores que deixam tudo mais redondo.
          </p>
        </header>
        <div className="space-y-4">
          {entries.map((entry) => (
            <section
              key={entry.date}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-5 shadow-[0_18px_35px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <p className="text-xs font-mono text-zinc-500">
                    {new Date(entry.date).toLocaleDateString("pt-BR")}
                  </p>
                  <h2 className="text-lg md:text-xl font-semibold leading-snug">
                    {entry.title}
                  </h2>
                </div>
                {entry.highlight && (
                  <span className="inline-flex items-center rounded-full border border-emerald-600/60 bg-emerald-900/30 px-3 py-0.5 text-[11px] text-emerald-300">
                    {entry.highlight}
                  </span>
                )}
              </div>

              {entry.image && (
                <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
                  <div className="relative aspect-video w-full">
                    <Image
                      src={entry.image.src}
                      alt={entry.image.alt}
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 640px, 100vw"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3 text-sm text-zinc-200">
                {entry.sections.map((section) => (
                  <div key={section.heading} className="space-y-1.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {section.heading}
                    </h3>
                    <ul className="space-y-1.5">
                      {section.items.map((item) => (
                        <li key={item.title} className="leading-relaxed">
                          <span className="font-medium text-zinc-50">{item.title}</span>
                          <span className="text-zinc-300/90"> – {item.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
