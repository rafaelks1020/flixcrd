# Backlog de Polimento do Sistema (Admin)

Branch de trabalho: `feature/system-polish`

Este arquivo concentra **ajustes, bugs, inconsistências e melhorias de UX** que vamos tratando aos poucos no painel admin e fluxos críticos.

---

## 0. Plano de ataque (prioridades)

### 0.1 Visão geral

- **P1 – Legendas & Playback**  
  Deixar legendas funcionais fim‑a‑fim (admin → transcoder → storage → playback web/app).
- **P2 – Notificações Push confiáveis**  
  Garantir registro de tokens, respeito às preferências e limpeza de tokens inválidos.
- **P3 – Segurança & Config (Cloudflare / JWT / Transcoder)**  
  Tirar segredos hardcoded e fallbacks perigosos, validar envs.
- **P4 – Dashboard, Status & Quick Actions**  
  Remover mocks e alinhar painel com dados reais de saúde do sistema.
- **P5 – Fluxo de Solicitações → Catálogo/Upload**  
  Polir UX, links e atalhos, mantendo a lógica atual.
- **P6 – Limpezas/baixa prioridade**  
  Arquivos mortos, stubs, pequenos ajustes cosméticos.

Os itens abaixo (1.x e 2.x) são a base de detalhes. O plano aqui só agrupa e prioriza.

### 0.2 P1 – Legendas & Playback (1.7, 1.10, 2.2)

- **Fase 1 – Arrumar Admin Subtitles para enxergar o catálogo certo**
  - Ajustar `SubtitlesPage` para consumir `/api/titles` no formato atual (`data.data`).
  - Incluir `?type=SERIES&limit=1000` (ou endpoint específico) para trazer todas as séries/animes relevantes.
  - Confirmar que a lista de séries/animes bate com o catálogo do `/admin/catalog`.
- **Fase 2 – Marcar no banco episódios com legenda**
  - Definir como persistir "tem legenda" (campo novo em `Episode` ou tabela auxiliar).
  - Atualizar fluxo de download/salvamento de legendas (Wasabi + transcoder se aplicável) para marcar esse estado.
  - Ligar `hasSubtitle` em `SubtitlesPage` a essa informação real.
- **Fase 3 – Playback consumindo legendas**
  - Atualizar rotas `titles/[id]/playback` e `episodes/[id]/playback` para montar `subtitles[]` com URLs `.vtt`.
  - Garantir que o `WatchClient` renderize `<track>` com base nesse array (já existe infra parcial).
  - Testar fluxo completo: episódio com legenda interna / externa → player exibindo seleção de legenda.
  
- **Status atual (P1)**
  - Mínimo viável entregue:
    - `SubtitlesPage` alinhado ao contrato paginado de `/api/titles` e carregando séries/animes de forma consistente com `/admin/catalog`.
    - `/api/titles/[id]/seasons` calcula `hasSubtitle` por episódio olhando `.vtt` reais no Wasabi (prefixo `episode.hlsPath`), e a UI do admin exibe badge visual 🟢/⚪.
    - Rotas de playback (`titles/[id]/playback`, `episodes/[id]/playback`) populam `subtitles[]` a partir dos `.vtt` em Wasabi, e o `WatchClient` gera `<track>` e permite selecionar legenda.
    - Fluxo de download OpenSubtitles → Wasabi automatizado em `/admin/subtitles` via `POST /api/subtitles/auto-download` (baixa, converte SRT→VTT e salva direto no storage).
  - Pendência opcional de modelagem: caso desejado, ainda podemos persistir metadados de legenda no banco em vez de depender apenas de detecção por arquivo.

### 0.3 P2 – Notificações Push (1.11)

- **Fase 1 – Visão confiável no admin**
  - Revisar `/api/admin/notifications` para suportar paginação ou visão agregada (não só `take: 100`).
  - Garantir que `/admin/notifications` deixe claro quantos tokens existem no total e por plataforma.
- **Fase 2 – Preferências de notificação**
  - Mapear tipos de eventos atuais (solicitações, novos conteúdos, etc.) → campos de `NotificationPreference`.
  - Criar um helper único de envio que aplique as preferências e sirva tanto para `/api/admin/notifications/send` quanto `/api/notifications/send`.
- **Fase 3 – Limpeza automática de tokens inválidos**
  - Centralizar o tratamento de respostas do Expo (DeviceNotRegistered) para todos os fluxos e expor métricas (sent/failed).
  - Adicionar contadores básicos em logs ou dashboard para acompanhar saúde dos envios.

### 0.4 P3 – Segurança & Config (1.5, 1.8)

- **Cloudflare / Cache**
  - Remover defaults hardcoded de `zoneId` e `apiKey` em `cloudflare-cache.ts`.
  - Fazer a inicialização falhar explicitamente se envs obrigatórias não forem fornecidas.
- **JWT mobile / NEXTAUTH_SECRET**
  - Remover `|| 'fallback-secret'` de `mobile-auth.ts` / `auth-mobile.ts`.
  - Adicionar verificação de env na inicialização (ex.: log claro de erro se `NEXTAUTH_SECRET` estiver vazio).
- **Transcoder / URLs internas**
  - Confirmar que `TRANSCODER_BASE_URL`, Wasabi e Cloudflare estão sempre vindo de envs e nunca hardcoded.

### 0.5 P4 – Dashboard, Status & Quick Actions (1.1, 1.2, 2.1, 2.4)

- **Fase 1 – Parar de mentir no uptime**
  - ✅ `/api/admin/uptime` agora usa o helper `collectUptimeSnapshot` para chamar `/api/status/database|storage|transcoder|cloudflare`.
  - ✅ Dashboard mostra, em tempo real, quantos serviços estão online e os detalhes de cada um (sem dados fake).
- **Fase 2 – Quick Actions reais**
  - ✅ Botão "Limpar Cache" aciona `/api/admin/cache` com `purge_all` e exibe retorno real.
  - 🔜 Demais ações (“Otimizar banco”, etc.) permanecem marcadas como “em desenvolvimento” até ganharem implementação real.
- **Fase 3 – Alinhar Status x Quick Actions**
  - 🔜 Harmonizar wording/cores entre `/admin/status` e quick actions usando o mesmo snapshot/histórico.
- **Fase 4 – Histórico e consistência**
  - ✅ Criada a tabela `ServiceStatusSnapshot` + rota `/api/admin/uptime/record` (cron horário definido no `vercel.json`) e `/api/admin/uptime/history`.
  - ✅ Card da dashboard passou a exibir heatmap das últimas checagens.
  - 🔜 Futuro: alertar quedas recorrentes (push/log), mostrar duração de incidentes e filtros por serviço.

### 0.6 P5 – Solicitações → Catálogo / Upload (1.9, 2.2, 2.3)

- **Fase 1 – Clarificar vínculos na UI admin**
  - ✅ `/api/admin/solicitacoes` expõe `upload` + `title`, com novo filtro `?upload=with|without`.
  - ✅ `/admin/solicitacoes` mostra badge “Upload pendente/concluído” + links `📚 Ver catálogo` e `⬆️ Abrir Upload V2`.
  - 🔜 Destacar SLA/prioridade com cores/ordenadores mais fortes para facilitar triagem.
- **Fase 2 – Atalhos de fluxo**
  - Adicionar ações compostas (ex.: "Assumir + marcar Em análise" em um clique).
  - Refinar integração com `upload-v2` (pré-selecionar título/temporada/episódio quando vier de uma solicitação).
  - Permitir filtros/botões rápidos no topo (ex.: “Somente uploads pendentes”) e surface de estado de workflow.
- **Fase 3 – Evolução de modelo (opcional/futuro)**
  - Avaliar migração de `imdbId` → `externalId` + `provider`.

### 0.7 P6 – Limpezas de baixa prioridade (1.3, 1.4, 1.6, partes de 2.x)

- Remover arquivos mortos como `page-improved.tsx` de jobs ou reaproveitar se houver plano claro.
- Revisar textos estáticos de versão/ambiente (`v2.0.0`, "Produção") para evitar confusão.
- Considerar, no futuro, tabela dedicada de logs se o volume/complexidade justificar (1.3).

---

## 1. Itens já identificados

### 1.1 Uptime (Dashboard / `/admin`)
- **Arquivo UI**: `src/components/admin/UptimeChart.tsx`
- **APIs**:
  - `src/app/api/admin/uptime/route.ts` – snapshot em tempo real usando `collectUptimeSnapshot`.
  - `src/app/api/admin/uptime/record/route.ts` – grava snapshot via cron/secret e persiste em `ServiceStatusSnapshot`.
  - `src/app/api/admin/uptime/history/route.ts` – retorna os últimos N snapshots para UI/monitoramento.
- **Situação atual**:
  - `collectUptimeSnapshot` centraliza as chamadas aos endpoints reais de status e evita duplicação de lógica.
  - `vercel.json` define cron horário chamando `/api/admin/uptime/record` para manter histórico automático (sem precisar configurar manualmente no painel).
  - O card consome `/api/admin/uptime` + `/api/admin/uptime/history?limit=48` e exibe heatmap/tooltips das últimas verificações.
- **Risco / impacto**:
  - Histórico mínimo implantado; precisamos evoluir para alertas automáticos, métricas de MTTR e filtros por serviço se o NOC exigir.

---

### 1.2 Ações Rápidas (`/admin/quick-actions`)
- **Arquivo**: `src/app/admin/quick-actions/page.tsx`

#### 1.2.1 Botão "Limpar Cache"
- **Código atual**:
  - `clearCache()` agora chama a API real de cache:
    - `POST /api/admin/cache` com `{ action: "purge_all" }`.
    - Usa um toast de loading e mostra a mensagem retornada pela API (sucesso/erro) em vez de simular.
- **Situação**:
  - Botão passou a ser **funcional**, disparando um purge total de cache via Cloudflare quando as envs estiverem configuradas.
  - Ainda é possível evoluir para ações mais granulares (por título/episódio) diretamente da UI.

#### 1.2.2 Botão "Otimizar Banco de Dados"
- **Código**:
  - Chama apenas `toast.success("Em breve!");`
  - Nota na UI: `* Atalhos em desenvolvimento`.
- **Situação**:
  - Funcionalidade claramente não implementada; está como stub/placeholder.
- **Decisão futura**:
  - Ou implementamos alguma rotina real de manutenção (ex.: job manual, ANALYZE, etc.),
  - Ou escondemos/desativamos até existir algo concreto para evitar expectativa falsa.

#### 1.2.3 Informações estáticas
- **Trechos**:
  - Versão fixa `v2.0.0`.
  - Ambiente fixo `Produção`.
- **Comentário**:
  - Não é exatamente bug, mas são valores hardcoded que podem divergir do ambiente real (homolog, dev, etc.).

---

### 1.3 Logs do Sistema (`/admin/logs`)
- **Arquivo UI**: `src/app/admin/logs/page.tsx`
- **API**: `src/app/api/admin/logs/route.ts`
- **Situação atual**:
  - Antes: 100% mockado com array de logs em memória.
  - Agora: exibe **atividades reais** do sistema, derivadas de:
    - Últimos títulos (`prisma.title`).
    - Últimas solicitações (`prisma.request`).
    - Últimos usuários (`prisma.user`).
    - Contadores de aprovações e solicitações pendentes.
  - Transforma isso em entradas de log com nível (`info`, `warning`, `success`, `error`) e categoria (Catálogo, Solicitações, Usuários, Sistema).
- **Pontos de atenção (melhorias futuras)**:
  - Ainda não existe uma tabela de logs dedicada no banco (tudo é derivado de outras tabelas).
  - Podemos, no futuro, registrar eventos críticos em uma tabela própria e misturar com essas atividades derivadas.

---

### 1.4 Analytics (`/admin/analytics`)
- **Arquivo UI**: `src/app/admin/analytics/page.tsx`
- **API**: `src/app/api/admin/stats/route.ts`
- **Situação atual**:
  - Removidos dados mockados.
  - API agora retorna dados reais agregados do banco:
    - Totais de títulos, HLS pronto, usuários, admins, filmes/séries/animes, episódios.
    - Novos usuários/títulos no período (7d, 30d, 90d) + variação % vs período anterior.
    - Totais de solicitações, pendentes, concluídas.
    - Usuários pendentes de aprovação.
    - Assinaturas ativas.
    - Top títulos por popularidade (score).
    - Uploads/títulos criados por dia (últimos 7 dias) calculados em memória.
  - A UI consome tudo isso e mostra cartões, gráfico de uploads, bloco de solicitações e top títulos.
- **Pendências / possíveis refinamentos**:
  - Popularidade: hoje baseada em campo `popularity` da tabela de títulos; podemos ajustar a métrica no futuro.
  - Performance: checar se as agregações seguram bem com catálogo maior.

---

### 1.5 Cloudflare Cache – Configuração perigosa
- **Arquivo**: `src/lib/cloudflare-cache.ts`
- **Problema**:
  - `CLOUDFLARE_CONFIG` define `zoneId` e `apiKey` com **defaults hardcoded** caso as envs não existam:
    ```ts
    zoneId: process.env.CLOUDFLARE_ZONE_ID || "88bf7...",
    apiKey: process.env.CLOUDFLARE_API_KEY || "6983f5...",
    ```
  - Isso não é mock: são valores reais embutidos, o que é **perigoso** e foge do padrão de usar apenas variáveis de ambiente.
- **Risco / impacto**:
  - Pode expor segredo em repositório.
  - Dificulta troca de credenciais/ambientes.
- **Direção desejada**:
  - Exigir envs obrigatórias e falhar claramente se não estiverem definidas (sem fallback hardcoded).

---

### 1.6 Arquivo de Jobs "improved" vazio
- **Arquivo**: `src/app/admin/jobs/page-improved.tsx`
- **Situação**:
  - Arquivo completamente vazio.
  - Parece rascunho abandonado de uma nova versão da página de jobs.
- **Impacto**:
  - Não quebra nada, mas polui o projeto e pode confundir quem busca pela versão "improved".
- **Ação sugerida**:
  - Remover o arquivo ou reaproveitar apenas se realmente formos usar uma versão nova.

### 1.7 Fluxo de Legendagem incompleto
- **Arquivos principais**:
  - Admin: `src/app/admin/subtitles/page.tsx`
  - Playback: `src/app/api/titles/[id]/playback/route.ts`, `src/app/api/episodes/[id]/playback/route.ts`
  - Player: `src/app/watch/[id]/WatchClient.tsx`
- **Situação ANTES**:
  - Admin conseguia buscar legendas externas (OpenSubtitles/Subdl) para episódios de séries/animes.
  - Em `SubtitlesPage`, cada episódio era criado com `hasSubtitle: false // TODO: verificar se já tem legenda` e isso nunca era atualizado com base em dados reais.
  - As rotas de playback (`titles/[id]/playback` e `episodes/[id]/playback`) sempre retornavam `subtitles: []` (há TODO explícito para implementar busca de `.vtt`).
  - O `WatchClient` já tem toda a infraestrutura para carregar e selecionar faixas de legenda, mas como o backend não envia nada, nenhum `<track>` é gerado e o usuário nunca vê legendas.
- **Situação atual**:
  - `SubtitlesPage`:
    - Consome `/api/titles?limit=1000` alinhado ao contrato paginado (ver 1.10) e lista séries/animes do catálogo.
    - Carrega episódios de `/api/titles/[id]/seasons` já com campo `hasSubtitle` real, calculado via checagem de `.vtt` em Wasabi com base em `episode.hlsPath`.
    - Exibe badge visual 🟢 "Com legenda" / ⚪ "Sem legenda" por episódio na UI.
  - Rotas de playback:
    - `titles/[id]/playback` e `episodes/[id]/playback` listam arquivos `.vtt` no Wasabi (prefixo `hlsPath`) e preenchem o array `subtitles` com `{ label, language, url }` para cada faixa encontrada.
  - Player:
    - `WatchClient` consome `subtitles[]` e renderiza `<track>` para cada legenda, permitindo seleção de faixa na reprodução.
  - Download automático:
    - A rota `POST /api/subtitles/auto-download` baixa legendas do OpenSubtitles, converte SRT→VTT e salva no Wasabi usando o prefixo do episódio.
    - `/admin/subtitles` passou a usar essa rota para OpenSubtitles; ao concluir o download, o badge do episódio é atualizado imediatamente para `hasSubtitle = true` na UI.
- **Próximos refinamentos (opcionais)**:
  - Modelar metadados de legendas em tabela própria (idioma, tipo, origem) em vez de depender apenas da convenção do nome do arquivo `.vtt`.
  - Implementar fluxo de remoção/substituição de legendas existentes e tratamento de múltiplas faixas por idioma.

---

### 1.8 Segurança: JWT_SECRET fallback / Cloudflare envs
- **Arquivos**:
  - Autenticação mobile: `src/lib/mobile-auth.ts`, `src/lib/auth-mobile.ts`
  - Cache/CDN: `src/lib/cloudflare-cache.ts`
- **Problema (JWT)**:
  - Tanto `mobile-auth` quanto `auth-mobile` usam:
    - `const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret';`
  - Se `NEXTAUTH_SECRET` não estiver configurado no ambiente, o sistema cai num segredo fixo e fraco (`fallback-secret`).
- **Problema (Cloudflare, complementar à seção 1.5)**:
  - `cloudflare-cache.ts` define `zoneId` e `apiKey` com defaults hardcoded caso as envs não existam.
  - Isso mistura configuração de produção com código fonte e dificulta isolar ambientes.
- **Impacto**:
  - JWT: tokens do app podem ser verificados/gerados com um segredo previsível se o env estiver incorreto.
  - Cloudflare: risco de exposição de credenciais no repo e dificuldade para trocar/rotacionar chaves por ambiente.
- **Direção desejada**:
  - Remover fallbacks inseguros (`|| 'fallback-secret'`) e exigir que `NEXTAUTH_SECRET` esteja sempre definido; caso contrário, falhar com erro claro na inicialização.
  - Para Cloudflare, manter apenas leitura via env (`CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_KEY`, `WASABI_CDN_URL`) e, na ausência, retornar erro explícito em vez de defaults embutidos.

---

### 1.9 Refinamentos de Solicitações
- **Arquivos principais**:
  - APIs públicas: `src/app/api/solicitacoes/route.ts`, `src/app/api/solicitacoes/[id]/route.ts`
  - APIs admin: `src/app/api/admin/solicitacoes/**`
  - UI usuário: `src/app/solicitacoes/SolicitacoesClient.tsx`, `src/app/solicitacao/[id]/RequestDetailClient.tsx`
  - UI admin: `src/app/admin/solicitacoes/page.tsx`
- **Situação atual (bom caminho)**:
  - Fluxo completo está funcional: criação de solicitação, followers automáticos, histórico (`RequestHistory`), cálculo de SLA/prioridade no admin, push notifications em ASSIGNED/STATUS_CHANGED/WORKFLOW_CHANGED/COMPLETED/REJECTED e integração com catálogo/upload-v2 via TMDB.
- **Pontos de refinamento identificados**:
  - Campo `imdbId` em `Request` é usado na prática para guardar `tmdbId` no fluxo web; funciona, mas é conceitualmente confuso.
  - A UI admin de `/admin/solicitacoes` mostra bem SLA/prioridade, mas ainda poderia expor mais claramente o vínculo com o título criado (link direto para o título/episódio quando houver `RequestUpload`).
  - Ações de status/workflow já existem via APIs dedicadas, mas a UX pode ser melhorada com mais presets/atalhos na UI (por exemplo, combos de "assumir + marcar Em análise" ou atalhos visuais por SLA/prioridade).
- **Direção desejada**:
  - Avaliar renomear em futura migração o campo `imdbId` para algo mais genérico (`externalId` + `provider`) para refletir melhor o uso real.
  - Enriquecer a tela admin de solicitações com links diretos para o título/episódio associado e indicadores visuais de SLA/prioridade ainda mais fortes.
  - Expôr na UI algumas sequências de ação comuns (assumir → workflow → upload) para reduzir cliques manuais.

---

### 1.10 Admin Subtitles sem séries / contrato antigo de `/api/titles`
- **Arquivo**: `src/app/admin/subtitles/page.tsx`
- **APIs relacionadas**: `src/app/api/titles/route.ts`, `src/app/api/titles/[id]/seasons/route.ts` (ou equivalente)
- **Problema 1 – contrato da lista de títulos desatualizado**:
  - A página de legendas faz:
    - `const res = await fetch("/api/titles");`
    - `const data = await res.json();`
    - `const allTitles = Array.isArray(data) ? data : (data.titles || []);`
  - Hoje a API `/api/titles` retorna **objeto paginado** no formato:
    - `{ data: Title[], page, limit, total, totalPages }`.
  - Como não existe `data.titles`, `allTitles` vira sempre `[]` (a menos que, por acaso, a API volte a retornar array direto).
  - Resultado: o select "Selecione uma série ou anime..." tende a ficar vazio ou incompleto.
- **Problema 2 – limite padrão esconde parte do catálogo**:
  - Mesmo que o contrato fosse corrigido, o fetch atual não passa `limit`, então cai no default de **24 itens apenas**.
  - Depois filtra séries/animes no cliente:
    - `allTitles.filter((t) => t.type === "SERIES" || t.type === "ANIME")`.
  - Isso significa que várias séries/animes **nem chegam** na tela de legendas.
- **Impacto**:
  - Admin pode achar que uma série/anime “não existe” para legendas, quando na verdade só não entrou nos 24 primeiros itens.
  - Dificulta muito usar o fluxo de legendas em catálogos maiores.
- **Status / o que já foi feito**:
  - `SubtitlesPage` agora chama `/api/titles?limit=1000` e é capaz de lidar tanto com o formato antigo (array direto) quanto com o formato paginado `{ data, page, ... }` usando `data.data`.
  - A lista exibida no select de `/admin/subtitles` filtra `SERIES`/`ANIME` de forma consistente com o que aparece em `/admin/catalog`.
- **Direção desejada (extra/futuro)**:
  - Opcionalmente, mover o filtro de tipo (`SERIES`/`ANIME`) para o backend usando um parâmetro `type` em `/api/titles`, reduzindo tráfego desnecessário.
  - Se o catálogo crescer muito, avaliar paginação real na UI de legendas em vez de depender de `limit=1000`.

---

### 1.11 Notificações Push – preferências ignoradas e limpeza parcial de tokens
- **Arquivos principais**:
  - Modelo: `PushToken`, `NotificationPreference` em `prisma/schema.prisma`.
  - APIs mobile: `src/app/api/notifications/register/route.ts`, `.../unregister`, `.../preferences`, `.../send`.
  - APIs admin: `src/app/api/admin/notifications/route.ts`, `.../send/route.ts`, `.../tokens/route.ts`.
  - Helper: `src/lib/push.ts` (`sendPushToUsers`).
- **Situação atual**:
  - Existe um modelo `NotificationPreference` e uma API `/api/notifications/preferences` para o app mobile salvar preferências do usuário (newContent, updates, recommendations).
  - Nenhum dos fluxos de envio (`sendPushToUsers`, `/api/admin/notifications/send`, `/api/notifications/send`) filtra tokens com base nessas preferências.
  - `sendPushToUsers` apenas envia para todos os `PushToken.isActive` dos usuários informados, sem olhar preferências nem resposta detalhada do Expo.
  - Já as rotas `/api/admin/notifications/send` e `/api/notifications/send` tratam parcialmente a resposta do Expo e desativam tokens com erro `DeviceNotRegistered`, mas o helper genérico não.
  - `/api/admin/notifications` usa `take: 100` ao listar tokens, o que limita a visão do admin em bases maiores.
- **Impacto**:
  - Usuários que desativarem certas categorias de notificação (quando o app usar `NotificationPreference`) ainda podem receber pushes que não gostariam.
  - Tokens inválidos obtidos via fluxos automáticos (`sendPushToUsers`) permanecem ativos por mais tempo, gerando erros silenciosos e desperdício de requests para o Expo.
  - Admin pode ter uma visão truncada dos dispositivos (apenas os 100 mais recentes).
- **Direção desejada**:
  - Integrar `NotificationPreference` aos filtros de envio (ex.: tipo de evento → campo correspondente na preferência).
  - Reaproveitar a lógica de tratamento da resposta do Expo (desativar `DeviceNotRegistered`) também em `sendPushToUsers`.
  - Avaliar paginação real ou contadores agregados em `/api/admin/notifications` para não limitar a 100 registros fixos.

---

## 2. Itens para investigação mais profunda

Aqui entra o que ainda vamos fuçar melhor (bugs, fluxos estranhos, inconsistências de UX, etc.).

### 2.1 Uptime real / histórico
- Como armazenar histórico de saúde dos serviços para ter um uptime mais verdadeiro?
- Ideias iniciais:
  - Rotina server-side que chame periodicamente `/api/status/*` e grave resultados (Redis, tabela `ServiceStatus`, etc.).
  - Dashboard lendo esse histórico em vez de gerar aleatório.

### 2.2 Fluxos de Upload (v1 vs v2)
- **Arquivos**:
  - Legacy: `src/app/admin/upload/page.tsx`.
  - Novo: `src/app/admin/upload-v2/page.tsx`.
- Pontos a validar:
  - UX de ter duas telas distintas de upload (pode confundir).
  - Coerência entre o que o admin faz em cada uma e o que vai para o player.

### 2.3 Integração Solicitações → Upload / Catálogo
- Garantir que o fluxo completo esteja redondo:
  - Usuário cria solicitação.
  - Admin vê em `/admin/solicitacoes` (prioridade/SLA, seguidores, etc.).
  - Admin atende criando título e fazendo upload (hoje já há integração em `upload-v2` via `titleId` e TMDB).
  - Verificar se há gaps de UX ou pontos pouco claros nesse funil.

### 2.4 Checks de Status vs Quick Actions
- Já existem endpoints de status (`/api/status/*`) e página dedicada `/admin/status`.
- Em `Ações Rápidas` há testes individuais de conexão.
- Vale alinhar mensagens/feedback entre essas telas para evitar resultados contraditórios.

### 2.5 TODO / FIXME relevantes
- Existem vários `TODO` espalhados (principalmente em admin/catalog, subtitles, APIs).
- Próximo passo será:
  - Listar aqui apenas os TODO/FIXME que impactam **admin, upload, solicitações, status e logs**.

---

## 3. Como usar este arquivo

- **Tudo que identificarmos** (bug, inconsciência, melhoria, ideia) entra neste MD, agrupado em seções.
- Quando algo for resolvido, podemos:
  - Marcar aqui como resolvido (com referência de commit/PR), ou
  - Mover para a seção **4. Itens concluídos** para manter um histórico rápido do que já foi entregue.
- A branch principal de trabalho para esses pontos é `feature/system-polish`.

## 4. Itens concluídos (resumo rápido)

### 4.1 P1 – Legendas & Playback (mínimo viável entregue)

- **Admin Subtitles alinhado ao catálogo**  
  - `SubtitlesPage` agora consome `/api/titles?limit=1000` no formato paginado `{ data, page, ... }` ou array direto, e filtra apenas títulos `SERIES`/`ANIME`.
  - A lista de séries/animes em `/admin/subtitles` bate com o que é exibido no `/admin/catalog`.
- **Detecção real de `hasSubtitle`**  
  - `/api/titles/[id]/seasons` monta a lista de episódios e verifica, para cada um, se existe `.vtt` correspondente em Wasabi usando o prefixo `episode.hlsPath`.
  - O campo `hasSubtitle` é preenchido a partir dessa checagem e usado em `/admin/subtitles` para exibir badges 🟢 "Com legenda" / ⚪ "Sem legenda".
- **Playback consumindo legendas**  
  - Rotas `titles/[id]/playback` e `episodes/[id]/playback` montam o array `subtitles[]` listando todos os `.vtt` encontrados no prefixo HLS (Wasabi), inferindo `label`/`language` pelo nome do arquivo.
  - O componente `WatchClient` consome esse array e renderiza `<track>` para cada legenda, permitindo ao usuário escolher a faixa.
- **Download automático de legendas**  
  - Criada a rota `POST /api/subtitles/auto-download` que, a partir de um `fileId` do OpenSubtitles e de um `episodeId`, baixa a legenda, descompacta (quando necessário), converte de SRT para VTT e salva no Wasabi sob o `episode.hlsPath`.
  - A página `/admin/subtitles` passou a usar essa rota para resultados do OpenSubtitles: ao clicar em "Baixar e Salvar", a legenda é enviada direto para o storage e o episódio já aparece como "Com legenda" na mesma tela.

### 4.2 Upload-v2 – IA para detecção de episódios

- **API server-side de detecção**  
  - Criada a rota `POST /api/admin/detect-episode` que usa `GROQ_API_KEY` e o modelo `llama-3.1-8b-instant` para analisar o nome do arquivo e retornar `{ season, episode, confidence }` em JSON.
- **Integração na tela `/admin/upload-v2`**  
  - A função `detectEpisodeWithAI` deixou de ser stub e agora chama a rota server-side, sendo usada tanto como fallback automático em `detectEpisode(...)` quanto no botão manual **🤖 IA** da lista de arquivos.
  - O botão **🤖 IA** mostra estado de carregamento ("🤖 Detectando..."), preenche `seasonNumber`/`episodeNumber` do arquivo quando a IA acerta e exibe mensagens de sucesso/erro na parte superior da tela.

### 4.3 Logs do Sistema (/admin/logs)

- **Remoção de mock e uso de dados reais**  
  - A antiga lista mockada em memória foi substituída por uma visão agregada construída a partir de dados reais do banco (`prisma.title`, `prisma.request`, `prisma.user`).
  - A API `/api/admin/logs` monta eventos com tipo (info/warning/success/error) e categoria (Catálogo, Solicitações, Usuários, Sistema), já usados pela UI em `/admin/logs`.
- **Benefício prático**  
  - O painel de logs passou a refletir atividades reais (novos títulos, novas solicitações, usuários criados, pendências, etc.), servindo como uma "linha do tempo" básica do sistema, mesmo sem ainda existir uma tabela de logs dedicada.

### 4.4 Analytics (/admin/analytics)

- **API de stats real**  
  - A rota `/api/admin/stats` deixou de retornar dados mockados e hoje agrega métricas reais do banco: totais de títulos (por tipo), episódios, usuários/admins, HLS pronto, solicitações (por status), assinaturas ativas, novos usuários/títulos no período e variações percentuais.
- **UI alinhada às métricas**  
  - A página `/admin/analytics` consome essas métricas e exibe cartões de resumo, gráfico de uploads/títulos criados por dia e blocos de solicitações e top títulos, todos baseados nos dados reais.
- **Observações**  
  - Já atende bem como painel operacional; refinamentos futuros ficam focados em performance e em ajustar a definição de "popularidade" conforme o catálogo crescer.
