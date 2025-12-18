---
 audience: admin
---

# FlixCRD – Changelog (Admin / Operação)

Resumo das mudanças que impactam o painel admin, fluxos de upload, legendas e monitoramento.

## 2025-12-16 – Módulo oculto "Lab" (integração SuperFlixAPI completa)

- **Nova rota interna**: `/lab` – Catálogo estilo Netflix idêntico à página inicial com Hero, busca exclusiva e carrosséis.
- **Página de detalhes**: `/lab/title/[id]?type=movie|tv` – Página completa do título com:
  - Hero com backdrop, poster, sinopse, gêneros, nota, duração
  - Para séries/animes: seletor de temporada + lista de episódios com thumbnails
  - Botão "Assistir" que leva ao player
- **Player integrado**: `/lab/watch?type=filme|serie&id=...&season=...&episode=...`
  - Filmes: usa IMDb ID → `superflixapi.run/filme/ttXXXXXXX`
  - Séries/Animes: usa TMDB ID → `superflixapi.run/serie/ID/temporada/episodio`
  - Player minimalista (somente vídeo + controles de temporada/episódio quando série)
  - Personalização visual aplicada por padrão: `#noEpList`, `#noLink`, `#transparent`, `#noBackground`
- **Persistência de busca**: resultados da busca são mantidos no localStorage ao navegar entre páginas.
- **Acesso controlado**: aparece no menu apenas para **ADMIN** ou quando `NEXT_PUBLIC_LAB_ENABLED=true`.
- **APIs proxy**:
  - `GET /api/lab/catalogo?type=movie|serie|anime&limit=N` – busca IDs da SuperFlixAPI + detalhes do TMDB
  - `GET /api/lab/busca?q=...` – busca no TMDB multi-search
  - `GET /api/lab/titulo/[id]?type=movie|tv` – detalhes completos do título (TMDB)
  - `GET /api/lab/titulo/[id]/temporada/[season]` – episódios da temporada (TMDB)
  - `GET /api/lab/lista` – proxy para `/lista` (IDs por categoria)
  - `GET /api/lab/calendario` – proxy para `/calendario.php`
  - `GET /api/lab/discover?category=movie|serie|anime&sort=...&year=...&genre=...&page=...&limit=...` – catálogo inteligente (TMDB discover filtrado por IDs disponíveis na SuperFlix)
  - `GET /api/lab/tmdb/genres?type=movie|tv` – lista de gêneros do TMDB para UI de filtros

- **Calendário (UI)**: `/lab/calendario` mostra lançamentos por dia/status com botões para abrir Detalhes e Assistir no player do Lab.

- **Catálogo Inteligente (UI)**: `/lab/explore` com filtros por categoria (Filmes/Séries/Animes), ordenação (popularidade/nota/votos/novidades), gênero e ano; resultados apontam para `/lab/title/...`.

## 2025-12-17 – Lab: Explore inteligente + seções automáticas

- **Explore inteligente**: `/lab/explore` ganhou seções automáticas antes dos filtros:
  - **Em alta no LAB** (tendências TMDB filtradas apenas para itens disponíveis na SuperFlix)
  - **Recomendados pra você** (TMDB recommendations baseado em seeds do localStorage do LAB)
- **Novas APIs**:
  - `GET /api/lab/trending?type=all|movie|tv&time=day|week&limit=N`
  - `GET /api/lab/recommendations?seeds=movie:ID,tv:ID&limit=N`
- **Estabilidade**: deduplicação reforçada em `discover/busca` para evitar warnings de React por keys duplicadas.

## 2025-12-17 – Métricas: Presença/Tempo online (MVP)

- **Heartbeat de presença**: o frontend envia batimentos periódicos para registrar sessão/lastSeen.
- **Métricas no admin**: `/admin/analytics` agora mostra:
  - Online agora (usuários/sessões)
  - Tempo online hoje (agregado)
  - Tempo online na janela (7/30/90d)
  - Top usuários por tempo online
- **Novas APIs**:
  - `POST /api/presence/heartbeat` (web/mobile)
  - `GET /api/admin/presence` (ADMIN)

## 2025-12-15 – Inter Boleto (Cobrança v3) + Webhook de ativação automática

### PWA (nível app)

- **Offline fallback** – rota `/offline` para fallback quando o usuário estiver sem internet.
- **Service Worker** – cache inteligente para assets estáticos + fallback offline (sem cachear streaming/API).
- **UX de instalação e atualização** – banner de instalar quando disponível e CTA de atualização quando houver nova versão.
- **Playback tipo app** – Media Session e Wake Lock para controles nativos e evitar tela apagando durante o vídeo.
- **Web Push (PWA)** – suporte a Web Push com VAPID + subscriptions por usuário, envio via admin e handler no Service Worker.

### Variáveis de ambiente (Web Push)

- `WEBPUSH_VAPID_PUBLIC_KEY`
- `WEBPUSH_VAPID_PRIVATE_KEY`
- `WEBPUSH_VAPID_SUBJECT` (ex: `mailto:suporte@...` ou `https://pflix.com.br`)

### Pagamentos (Inter)

- **Boleto Inter (Cobrança v3)** – `POST /api/subscription/create` com `billingType=BOLETO` emite cobrança no Inter e grava `Payment.asaasPaymentId = codigoSolicitacao` (UUID do Inter) e `Payment.invoiceUrl = "INTER"`.
- **PIX Inter** – `POST /api/subscription/create` com `billingType=PIX` emite cobrança imediata no Inter e grava `PixPayment.txid` e `Payment.asaasPaymentId = txid`.
- **PDF do boleto via proxy** – `GET /api/payments/:paymentId/invoice` retorna `application/pdf` baixado do Inter quando o pagamento for do Inter.
- **Webhook Inter Cobrança (boleto)** – novo endpoint `POST /api/webhooks/inter/cobranca`:
  - Valida token por header (`x-webhook-token` / `x-inter-webhook-token` / `inter-webhook-token`) quando `INTER_WEBHOOK_TOKEN` (ou `INTER_COBRANCA_WEBHOOK_TOKEN` / `INTER_BOLETO_WEBHOOK_TOKEN`) estiver definido.
  - Confirma o status **server-to-server** consultando o Inter (`GET /cobranca/v3/cobrancas/{codigoSolicitacao}`).
  - Atualiza `Payment` e ativa a `Subscription` de forma **idempotente** (evita reprocessar o mesmo pagamento e evita email duplicado).
- **Webhook Inter PIX** – endpoint `POST /api/webhooks/inter/pix`:
  - Protegido por token (em produção **exige** `INTER_WEBHOOK_TOKEN` ou `INTER_PIX_WEBHOOK_TOKEN`).
  - Aceita payload no formato `[{...}]` e também `{ pix: [{...}] }`.
  - Confirma o status **server-to-server** consultando o Inter (`GET /pix/v2/cob/{txid}`), valida valor e ativa a assinatura de forma **idempotente**.

### Variáveis de ambiente (Inter)

- `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET` (OAuth)
- `INTER_CERTIFICATE` e `INTER_PRIVATE_KEY` (mTLS)
- `INTER_CONTA_CORRENTE` (quando aplicável)
- `INTER_WEBHOOK_TOKEN` para proteger webhooks (PIX e Cobrança)
- `INTER_PIX_WEBHOOK_TOKEN` (opcional) para proteger apenas o webhook PIX
- `INTER_COBRANCA_WEBHOOK_TOKEN` / `INTER_BOLETO_WEBHOOK_TOKEN` (opcional) para proteger apenas o webhook Cobrança

### Seletor de provedor (ASAAS vs INTER)

- **Provider por ambiente** – é possível escolher o gateway de cobrança por env:
  - `PAYMENTS_PROVIDER_PIX=ASAAS|INTER`
  - `PAYMENTS_PROVIDER_BOLETO=ASAAS|INTER`
  - fallback: `PAYMENTS_PROVIDER_DEFAULT=ASAAS|INTER` (ou `PAYMENTS_PROVIDER` / `PAYMENT_PROVIDER`)
- **Override por request (opcional)** – `POST /api/subscription/create` aceita `paymentProvider: "ASAAS" | "INTER"`.
- **Padrão (sem env/payload)** – volta para **ASAAS** (INTER é opt-in).

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
