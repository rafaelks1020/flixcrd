"use client";

export default function AdminChangelogPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold">📝 Changelog do Admin</h2>
        <p className="text-zinc-400 text-sm">
          Resumo das principais mudanças recentes que impactam o painel admin, upload, legendas e monitoramento.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 space-y-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-mono text-zinc-500">2025-12-09</p>
            <h3 className="text-lg font-semibold">Legendas, Upload v2 com IA e painéis mais honestos</h3>
          </div>
          <span className="inline-flex items-center rounded-full border border-emerald-600/60 bg-emerald-900/30 px-3 py-0.5 text-[11px] text-emerald-300">
            Lote de melhorias P1 / infra
          </span>
        </div>

        <div className="space-y-4 text-sm text-zinc-100">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Legendas & Playback
            </h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-200/90">
              <li>
                <strong>Admin Subtitles alinhado ao catálogo</strong>: `SubtitlesPage` passou a consumir
                `/api/titles?limit=1000`, entendendo o formato paginado {"{ data, page, ... }"} e filtrando
                somente `SERIES`/`ANIME`, em linha com `/admin/catalog`.
              </li>
              <li>
                <strong>Flag real de `hasSubtitle` por episódio</strong>: `/api/titles/[id]/seasons` agora calcula
                `hasSubtitle` verificando arquivos `.vtt` em Wasabi com base em `episode.hlsPath`, e a UI de
                `/admin/subtitles` exibe badges 🟢 / ⚪ por episódio.
              </li>
              <li>
                <strong>Playback consumindo legendas</strong>: rotas `titles/[id]/playback` e
                `episodes/[id]/playback` listam `.vtt` no storage e montam `subtitles[]` com {"{ label, language, url }"},
                usados pelo `WatchClient` para renderizar {"<track>"}.
              </li>
              <li>
                <strong>Download automático de legendas</strong>: nova rota `POST /api/subtitles/auto-download` que
                baixa do OpenSubtitles, converte SRT→VTT e salva no Wasabi sob o prefixo do episódio. A tela de
                legendas ganhou o botão &quot;Baixar e Salvar&quot; que atualiza o badge do episódio para &quot;Com legenda&quot;.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Upload v2 & IA
            </h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-200/90">
              <li>
                <strong>API de IA para detecção de episódios</strong>: criada rota `POST /api/admin/detect-episode`,
                usando `GROQ_API_KEY` + modelo `llama-3.1-8b-instant` para retornar {"{ season, episode, confidence }"}
                a partir do nome do arquivo.
              </li>
              <li>
                <strong>Fallback inteligente em `upload-v2`</strong>: `detectEpisodeWithAI` deixou de ser stub e agora
                chama a rota server-side. `detectEpisode(...)` usa parser meticuloso primeiro e, se não tiver
                confiança, cai para IA automaticamente.
              </li>
              <li>
                <strong>Botão 🤖 IA por arquivo</strong>: na lista de arquivos do `/admin/upload-v2`, o botão
                &quot;🤖 IA&quot; tenta corrigir apenas aquele item, mostra estado &quot;🤖 Detectando...&quot; enquanto a requisição
                está em andamento e exibe mensagens claras de sucesso/erro no topo da tela.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Logs & Analytics
            </h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-200/90">
              <li>
                <strong>Logs baseados em dados reais</strong>: `/admin/logs` agora monta eventos a partir de
                `prisma.title`, `prisma.request` e `prisma.user`, além de pendências de aprovação/solicitações,
                em vez de usar um array mockado.
              </li>
              <li>
                <strong>Analytics com stats reais</strong>: `/api/admin/stats` agrega métricas reais (títulos,
                HLS pronto, usuários, assinaturas, solicitações, variações por período) e a tela
                `/admin/analytics` mostra cards, gráficos e blocos baseados nesses dados.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Correções de bugs / infra</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-200/90">
              <li>
                <strong>Catálogo admin com visão completa</strong>: `/admin/catalog` passou a carregar
                `/api/titles?limit=1000`, evitando que o limite padrão de 24 itens esconda parte do catálogo.
              </li>
              <li>
                <strong>Subtitles respeitando contrato paginado</strong>: `SubtitlesPage` foi ajustado para entender
                o formato {"{ data, page, ... }"} e garantir que todas as séries/animes fiquem disponíveis para
                gerenciamento de legendas.
              </li>
              <li>
                <strong>Transcodificação HLS mais estável</strong>: comando `ffmpeg` do transcoder passou a forçar
                `-pix_fmt yuv420p`, resolvendo o erro de 10-bit com `profile high` e aumentando a compatibilidade
                com diferentes fontes.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
