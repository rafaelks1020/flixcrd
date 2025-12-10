---
 audience: admin
---

# FlixCRD – Changelog (Admin / Operação)

Resumo das mudanças que impactam o painel admin, fluxos de upload, legendas e monitoramento.

## 2025-12-10 – Mailjet, Recuperação de Senha e Cron visível

### Comunicação & Emails (Mailjet)
- **Mailjet integrado e documentado** – `MAILJET-SETUP.md` com variáveis, testes e troubleshooting. Remetentes separados por tipo (`suporte@`, `contato@`, `financeiro@`).
- **Notificação de solicitações** – toda nova solicitação de conteúdo dispara email automático para o admin (`ADMIN_EMAIL`) com detalhes e link direto para `/admin/solicitacoes`.
- **Pagamentos** – emails transacionais para PIX (QR + copia-e-cola), boleto (link), cartão aprovado e confirmação/atraso via webhook Asaas.

### Recuperação de Senha
- **API de reset** – rotas `POST /api/auth/forgot-password` (gera token 1h) e `POST /api/auth/reset-password` (troca a senha e limpa tokens).
- **Persistência segura** – tabela `PasswordResetToken` com expiração e limpeza automática de tokens usados.

### Monitoramento de Cron
- **Dispatcher `/api/rodaCron`** – distribui tarefas internas respeitando intervalos configurados em banco (`CronTask`).
- **Painel no admin** – seção “Cron Jobs” em `/admin/status` exibindo última execução, status HTTP e duração de cada tarefa.

## 2025-12-09 – Limpeza de Lint, Tipagem e Estabilidade

### Qualidade de Código & TypeScript

- **Eliminação massiva de `any`** – Substituídos ~100 usos de `any` por tipos específicos em componentes, hooks e rotas de API. Interfaces tipadas para `TitleData`, `CastMember`, `CrewMember`, `Season`, `Episode`, `Video`, etc.
- **Eventos HLS tipados** – Criadas interfaces `HlsLevelData`, `HlsManifestData`, `HlsErrorData` para tipar corretamente os handlers de eventos do player HLS.
- **Middleware tipado** – Adicionada interface `ExtendedToken` para substituir casts `any` no middleware de autenticação.
- **Catch errors tipados** – Substituídos todos os `catch (err: any)` por `catch (err)` com verificação `instanceof Error` em ~35 arquivos.
- **ESLint config atualizado** – Scripts e arquivos de configuração (`scripts/**`, `*.config.js`) adicionados ao `globalIgnores` para evitar erros de `require()`.

### Correções de React Hooks

- **VideoPlayerNative** – Refatorado `resetControlsTimeout` para `useCallback`, corrigido setState síncrono dentro de efeito usando `setTimeout(..., 0)`.
- **useServiceMonitor** – Removida variável `error` não usada no catch.
- **useTheme** – Refatorado para usar lazy init no estado inicial.

### Correções de Variáveis Não Usadas

- **TitleCard** – Comentado import `Image` não usado.
- **TitleDetailHero** – Marcado `showTrailer` como usado com `void`.
- **HeroSection** – Marcados `isMuted`/`showVideo` como preparados para uso futuro.
- **Navbar** – Marcado `onSearch` como disponível para futuro.
- **PremiumTitleCard** – Marcado `backdropUrl` como disponível para futuro.
- **SearchBar** – Escapadas aspas duplas para evitar erro `react/no-unescaped-entities`.

### Build & Compatibilidade

- **Build passa 100%** – Todas as correções de tipo garantem que `npm run build` completa sem erros.
- **Lint reduzido** – De 476 para ~360 problemas (273 erros, 87 warnings). Os warnings restantes são recomendações de `next/image`.
- **Prisma Client** – Regenerado para garantir tipos atualizados do schema.

---

## 2025-12-09 – Legendas, Upload v2 com IA e painéis mais honestos

### Notificações Push & Dispositivos

- **Visão paginada e contadores por plataforma** – `/api/admin/notifications` agora aceita `page/limit` (até 200) e retorna estatísticas globais (total, ativos, Android, iOS, Web).
- **Admin Notifications com navegação de páginas** – a tela `/admin/notifications` mostra quantas páginas existem, permite avançar/voltar e mantém os filtros por plataforma/ativo.

### Status & Ações Rápidas

- **Card de status real no dashboard** – `UptimeChart` passou a exibir o estado real de banco, storage, transcoder e proxy/CDN, usando `/api/admin/uptime` que chama `/api/status/*` em vez de gerar números aleatórios.
- **Limpar Cache de verdade** – o botão “Limpar Cache” em `/admin/quick-actions` dispara `POST /api/admin/cache` com `action: "purge_all"` e mostra mensagens reais de sucesso/erro.

### Segurança & Configuração

- **JWT mobile sem fallback fraco** – `mobile-auth.ts` e `auth-mobile.ts` deixaram de usar `NEXTAUTH_SECRET || 'fallback-secret'`; agora falham explicitamente se `NEXTAUTH_SECRET` não estiver definido.
- **Cloudflare só via env** – `cloudflare-cache.ts` não tem mais `zoneId`/`apiKey` hardcoded; as credenciais são lidas apenas de `CLOUDFLARE_ZONE_ID` e `CLOUDFLARE_API_KEY` com validação obrigatória.

### Legendas & Playback

- **Admin Subtitles alinhado ao catálogo** – `SubtitlesPage` agora consome `/api/titles?limit=1000` no formato paginado (`data`) e lista apenas títulos `SERIES`/`ANIME`, alinhado ao que aparece no `/admin/catalog`.
- **Flag real de `hasSubtitle` por episódio** – a rota `/api/titles/[id]/seasons` passou a calcular `hasSubtitle` por episódio checando `.vtt` correspondentes em Wasabi (prefixo baseado em `episode.hlsPath`). A tela `/admin/subtitles` usa esse campo para exibir badge 🟢 "Com legenda" / ⚪ "Sem legenda".
- **Playback consumindo legendas** – as rotas de playback para títulos e episódios agora listam `.vtt` no storage e montam `subtitles[]` com `{ label, language, url }`, usados pelo `WatchClient` para criar faixas de legenda selecionáveis.
- **Download automático de legendas** – criada a rota `POST /api/subtitles/auto-download`, que recebe `episodeId`, `fileId` (OpenSubtitles) e `language`, baixa o arquivo (SRT ou compactado), converte para VTT e salva em Wasabi sob o prefixo do episódio. A tela `/admin/subtitles` ganhou o botão **Baixar e Salvar**, que marca o episódio como "Com legenda" após concluir.

### Upload v2 & IA

- **API de IA para detecção de episódio** – nova rota `POST /api/admin/detect-episode` usando `GROQ_API_KEY` e o modelo `llama-3.1-8b-instant` para analisar nomes de arquivos e retornar `{ season, episode, confidence }`.
- **Upload v2 com fallback inteligente** – `detectEpisodeWithAI` deixou de ser stub e agora chama a rota server-side de IA. A função `detectEpisode(...)` usa primeiro o parser meticuloso e, quando a confiança é baixa ou não encontra nada, aciona a IA automaticamente.
- **Botão 🤖 IA por arquivo** – na lista de arquivos em `/admin/upload-v2`, o botão 🤖 IA tenta corrigir apenas aquele arquivo, mostra estado "Detectando..." durante a chamada e exibe mensagens claras de sucesso/erro no topo da tela.

### Logs & Analytics

- **Logs baseados em dados reais** – `/admin/logs` deixou de depender de array mockado em memória. A API `/api/admin/logs` agora constrói eventos (info/warning/success/error) a partir de títulos, solicitações, usuários e pendências de aprovação/solicitações.
- **Analytics com métricas reais** – a rota `/api/admin/stats` agrega dados reais: totais de títulos (por tipo), HLS pronto, episódios, usuários/admins, assinaturas, solicitações por status, novos usuários/títulos em janelas de tempo e variações percentuais. A tela `/admin/analytics` consome essa API e mostra cards, gráfico de uploads por dia e blocos de solicitações/top títulos com base nessas métricas.

### Correções de bugs

- **Catálogo admin não listava séries/animes** – `/admin/catalog` passou a chamar `GET /api/titles?limit=1000`, evitando que o limite padrão de 24 itens esconda parte do catálogo. Os filtros por tipo (MOVIE/SERIES/ANIME) agora atuam sobre um conjunto muito mais completo.
- **Admin Subtitles com catálogo incompleto** – `SubtitlesPage` foi atualizado para usar `/api/titles?limit=1000` e interpretar corretamente o formato paginado (`{ data, ... }`), garantindo que todas as séries/animes fiquem disponíveis para gerenciamento de legendas.
- **`hasSubtitle` sempre falso para episódios** – a rota `/api/titles/[id]/seasons` passou a consultar o storage para marcar `hasSubtitle` com base na existência de `.vtt`; a lista de episódios em `/admin/subtitles` agora reflete o estado real das legendas.
- **Transcodificação HLS falhando com fontes 10‑bit** – o comando `ffmpeg` do transcoder foi ajustado para forçar `-pix_fmt yuv420p` antes de usar `libx264` com `profile high`, corrigindo o erro de bit depth e aumentando a compatibilidade com diferentes arquivos de origem.
