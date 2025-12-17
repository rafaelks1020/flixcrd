# FlixCRD – Bugfix Log

Arquivo dedicado para registrar **todas as correções de bugs** feitas no sistema.

Regras de uso:
- Sempre que um bug for corrigido (backend, admin, app, transcoder, infra ligada ao app), registrar aqui.
- Registrar: data, contexto, sintomas, causa raiz, mudança aplicada e arquivos afetados.
- Não registrar ajustes puramente visuais sem impacto funcional.

---

## 2025-12-17 – Presence Heartbeat: web retornava 401 (não autenticado) e não registrava sessões

- **Sintoma**  
  O `POST /api/presence/heartbeat` retornava `401 Não autenticado` no frontend web (session NextAuth via cookie), impedindo registrar presença/tempo online.

- **Causa raiz**  
  O endpoint estava validando autenticação apenas via `Authorization: Bearer ...` (helper `getAuthUser`), mas o web usa sessão NextAuth (cookie) na maioria das requisições.

- **Correção aplicada**  
  O endpoint passou a aceitar autenticação por **sessão NextAuth** (via `getServerSession(authOptions)`) e, como fallback, continuar aceitando **Bearer token** para o app mobile.

- **Arquivos envolvidos**  
  - `src/app/api/presence/heartbeat/route.ts`

- **Status**: Resolvido.

## 2025-12-17 – Lab: warning/erro de React por keys duplicadas no catálogo ("Encountered two children with the same key")

- **Sintoma**  
  No `/lab`, ao renderizar a grade de catálogo/busca, o console exibia:
  `Encountered two children with the same key ...`.

- **Causa raiz**  
  As rotas do Lab (`/api/lab/discover` e/ou `/api/lab/busca`) podem retornar itens duplicados (mesmo `type` + `tmdbId`). O `LabClient` renderizava a lista usando keys que colidiam nesses casos.

- **Correção aplicada**  
  - Deduplicação no client por chave estável `type + tmdbId` antes de salvar no estado.
  - Ajuste das `keys` do React para usar chave estável (`type-tmdbId`).

- **Arquivos envolvidos**  
  - `src/app/lab/LabClient.tsx`

- **Status**: Resolvido.

## 2025-12-17 – Lab Explore: warning/erro de React por keys duplicadas ("Encountered two children with the same key")

- **Sintoma**  
  No `/lab/explore`, ao renderizar `TitleRow`, o console exibia:
  `Encountered two children with the same key ...`.

- **Causa raiz**  
  As rotas `/api/lab/discover` e `/api/lab/busca` podem retornar itens repetidos durante o scan de múltiplas páginas. O Explore renderizava a lista usando `id` derivado de `type + tmdbId`, gerando colisão quando vinham duplicados.

- **Correção aplicada**  
  - Deduplicação no client (`LabExploreClient`) antes de salvar resultados em estado.
  - Deduplicação também nas APIs `/api/lab/discover` e `/api/lab/busca` durante o scan para evitar repetição na origem.

- **Arquivos envolvidos**  
  - `src/app/lab/explore/LabExploreClient.tsx`
  - `src/app/api/lab/discover/route.ts`
  - `src/app/api/lab/busca/route.ts`

- **Status**: Resolvido.

## 2025-12-16 – Admin não conseguia abrir detalhes de solicitação (404 “Solicitação não encontrada”)

- **Sintoma**  
  A solicitação aparecia na listagem, mas ao abrir o link `/solicitacao/{id}` a tela mostrava “Solicitação não encontrada.”

- **Causa raiz**  
  A rota `GET /api/solicitacoes/[id]` restringia acesso ao **dono** ou **seguidor** da solicitação. Ao acessar como **ADMIN**, o usuário não era dono/seguidor e o endpoint retornava `404` (por design), causando a mensagem no frontend.

- **Correção aplicada**  
  Permitimos que `role === "ADMIN"` retorne a solicitação diretamente no endpoint `GET /api/solicitacoes/[id]`.

- **Arquivos envolvidos**  
  - `src/app/api/solicitacoes/[id]/route.ts`

- **Status**: Resolvido.

## 2025-12-16 – Lab: clicar em Anime/Série abria 404 (link apontava para /title)

- **Sintoma**  
  Ao clicar em cards de **Séries/Animes** no módulo `/lab`, o usuário caía em `404` (rota do app principal) em vez de abrir a página de detalhes do Lab.

- **Causa raiz**  
  O componente `TitleCard` estava com o `Link` hardcoded para `href={/title/${id}}`, o que fazia qualquer uso fora do catálogo principal (ex.: Lab) navegar para a rota errada.

- **Correção aplicada**  
  - Adicionado `href?: string` no `TitleCard`.
  - `TitleRow` passou a aceitar/repasse `href` via spread props.
  - `LabClient` passou a preencher `href` para apontar para `/lab/title/{tmdbId}?type=tv|movie`.

- **Arquivos envolvidos**  
  - `src/components/ui/TitleCard.tsx`
  - `src/components/ui/TitleRow.tsx`
  - `src/app/lab/LabClient.tsx`

- **Status**: Resolvido.

## 2025-12-16 – Lab: player travado na tela “Disponível apenas via iframe”

- **Sintoma**  
  Ao abrir `/lab/watch` em alguns títulos, o embed não carregava o player e mostrava uma tela com mensagem “Disponível apenas via iframe” e botão “Visualização”.

- **Causa raiz**  
  O embed adiciona um “gate” de proteção que exige interação/click em “Visualização” antes de renderizar o conteúdo do player.

- **Correção aplicada**  
  Atualizado o script injetado no proxy `/api/lab/proxy/*` para:
  - Normalizar acentos no matcher de texto (ex.: `Visualização` → `visualizacao`).
  - Auto-clicar em “Visualização” antes de tentar áudio/servidor/play.
  - Esconder o bloco do gate quando detectado.

- **Arquivos envolvidos**  
  - `src/app/api/lab/proxy/[...path]/route.ts`
  - `src/app/lab/watch/LabWatchClient.tsx`

- **Status**: Resolvido.

## 2025-12-16 – Lab: player não carregava (tela preta) devido a script de autoplay

- **Sintoma**  
  Ao abrir `/lab/watch`, o iframe ficava completamente preto e não exibia o player da SuperFlixAPI.

- **Causa raiz**  
  O script de autoplay/auto-seleção injetado no proxy estava:
  - Escondendo elementos grandes demais (incluindo o container do player).
  - Clicando em elementos genéricos (`div`) causando comportamento inesperado.
  - Tentando manipular o DOM antes do player carregar completamente.

- **Correção aplicada**  
  Removido completamente o script de autoplay/auto-seleção do proxy `/api/lab/proxy/*`. O proxy agora apenas:
  - Injeta `<base href>` para rewrite de URLs relativas.
  - Reescreve URLs da SuperFlixAPI para passar pelo proxy same-origin.
  - Deixa o player padrão da SuperFlixAPI carregar normalmente sem interferência.

- **Arquivos envolvidos**  
  - `src/app/api/lab/proxy/[...path]/route.ts`

- **Status**: Resolvido.

## 2025-12-12 – /subscribe quebrando build TypeScript (JSX dentro de useEffect)

- **Sintoma**  
  `next build` falhava com erro de TypeScript informando que o callback do `useEffect` estava retornando `JSX.Element`.

- **Causa raiz**  
  Um bloco de UI (tela de boleto pendente) foi inserido por engano dentro do `useEffect`, gerando `return (<div ... />)` no callback do hook.

- **Correção aplicada**  
  Removemos o bloco de renderização do `useEffect` e mantivemos a tela de boleto pendente apenas na seção normal de render (condicional antes do `return` principal).

- **Arquivos envolvidos**  
  - `src/app/subscribe/page.tsx`

- **Status**: Resolvido.

---

## 2025-12-12 – App mobile: erro de tipagem ao navegar para tela de Pagamentos

- **Sintoma**  
  TypeScript acusava erro ao chamar `router.push('/payments')` (tipagem `Href<...>`), impedindo build/typecheck.

- **Causa raiz**  
  Tipagem de rotas do Expo Router não estava aceitando a string literal de navegação naquele ponto do código.

- **Correção aplicada**  
  Ajustamos a navegação no item “Assinatura” do perfil para abrir a rota de Pagamentos usando cast compatível.

- **Arquivos envolvidos**  
  - `flixcrd-app/app/(tabs)/profile.tsx`

- **Status**: Resolvido.

---

## 2025-12-12 – App mobile: `tsc` falhando (router.push em rotas dinâmicas + style inválido)

- **Sintoma**  
  `npx tsc -p tsconfig.json --noEmit` falhava com erros de tipagem ao navegar com `router.push("/watch/..." )` e em um `style={[..., error && ...]}`.

- **Causa raiz**  
  - Tipagem do Expo Router não aceitou template strings em algumas chamadas de `router.push`.
  - `error && styles.inputError` podia retornar `""` (string vazia) e isso não é um `ViewStyle` válido.

- **Correção aplicada**  
  - Ajustamos as chamadas para `router.push(... as any)` onde necessário.
  - Ajustamos o style para `error ? styles.inputError : undefined`.

- **Arquivos envolvidos**  
  - `flixcrd-app/app/(tabs)/home.tsx`
  - `flixcrd-app/app/title/[id].tsx`
  - `flixcrd-app/src/contexts/NotificationContext.tsx`
  - `flixcrd-app/src/components/ui/Input.tsx`

- **Status**: Resolvido.

---

## 2025-12-12 – Admin: histórico de pagamentos (sem entrar na conta do usuário)

- **Contexto**  
  Necessidade de consultar pagamentos de qualquer usuário pelo painel admin, sem depender de login na conta do cliente.

- **Mudança aplicada**  
  - Criada rota `GET /api/admin/payments` (somente ADMIN) com busca e filtros (q/email/nome/asaasPaymentId/userId/status/billingType/período) e paginação.
  - Criada página `/admin/payments` com tabela de pagamentos, links de boleto/fatura, copiar PIX e copiar `asaasPaymentId`.
  - Adicionado item “Pagamentos” no menu lateral do Admin.
  - Ajustado filtro Prisma para relações usando `is` (evita erro em runtime ao filtrar por `Subscription`/`User`).

- **Arquivos envolvidos**  
  - `src/app/api/admin/payments/route.ts`
  - `src/app/admin/payments/page.tsx`
  - `src/app/admin/layout.tsx`

- **Status**: Resolvido.

---

## 2025-12-12 – Pagamentos white label: boleto/fatura via proxy no domínio

- **Objetivo**  
  Evitar exposição direta do Asaas na experiência do usuário (links e labels), servindo boleto/fatura por endpoint próprio e padronizando URLs.

- **Mudança aplicada**  
  - Criado endpoint `GET /api/payments/[paymentId]/invoice` que valida permissões (dono ou ADMIN) e faz proxy do boleto/fatura pelo domínio do app.
  - `POST /api/subscription/create` passou a:
    - Persistir o `Payment` no banco em variável (`dbPayment`).
    - Retornar `payment.id` como **ID interno** (Prisma) para o frontend.
    - Retornar `invoiceUrl` como `/api/payments/{paymentId}/invoice`.
    - Enviar email de boleto usando o link do próprio domínio.
  - `GET /api/payments` e `/payments` passaram a expor `invoiceUrl` apontando para o proxy.
  - UI `/payments` deixou de exibir explicitamente "Asaas: {id}".

- **Arquivos envolvidos**  
  - `src/app/api/payments/[paymentId]/invoice/route.ts`
  - `src/app/api/subscription/create/route.ts`
  - `src/app/api/payments/route.ts`
  - `src/app/payments/page.tsx`
  - `src/app/payments/PaymentsClient.tsx`

- **Status**: Parcial (white label total ainda depende de como o PDF do boleto é gerado pelo gateway).

---

## 2025-12-12 – App mobile: Solicitações (criar/seguir) + gating do player + stream token (POST)

- **Contexto**  
  Completar o módulo de Solicitações no app (criar + acompanhar) e evitar playback sem assinatura/perfil selecionado.

- **Causa raiz**  
  - O app não tinha UI para criar Solicitações nem ação de seguir/acompanhar.
  - O app tinha chamada `getStreamToken()` como GET/sem body, porém o backend exige `POST` com `contentType` e `contentId`.
  - Era possível tentar chegar em playback sem ter perfil selecionado e sem assinatura ativa (UX ruim). Além disso, as rotas de playback de `titles/episodes` não faziam o mesmo gating de assinatura da rota `/api/stream/token`.

- **Correção aplicada**  
  - App:
    - Criada tela `requests/create` para enviar uma solicitação.
    - Implementada ação de seguir/acompanhar solicitação no detalhe.
    - Lista de solicitações passou a incluir também solicitações seguidas usando `GET /api/solicitacoes?scope=all`.
    - Player passou a bloquear antes de carregar o vídeo se não houver perfil selecionado e se a assinatura não estiver ativa (`/api/subscription/check`).
    - `getStreamToken` foi ajustado para `POST` com body e tipagem compatível com a resposta do backend.
  - Backend:
    - `GET /api/solicitacoes` passou a aceitar `scope=all` (minhas + seguidas).
    - Rotas `/api/titles/[id]/playback` e `/api/episodes/[id]/playback` passaram a exigir assinatura ativa (ou ADMIN), evitando bypass.

- **Arquivos envolvidos**  
  - `flixcrd-app/src/services/api.ts`
  - `flixcrd-app/src/types/index.ts`
  - `flixcrd-app/app/(tabs)/requests.tsx`
  - `flixcrd-app/app/requests/create.tsx`
  - `flixcrd-app/app/requests/[id].tsx`
  - `flixcrd-app/app/watch/[id].tsx`
  - `src/app/api/solicitacoes/route.ts`
  - `src/app/api/titles/[id]/playback/route.ts`
  - `src/app/api/episodes/[id]/playback/route.ts`

- **Status**: Resolvido.

---

## 2025-12-12 – Proxy de boleto/PIX em localhost retornava HTML do gateway (erro de domínio/site key)

- **Sintoma**  
  Ao abrir o link white-label `/api/payments/{paymentId}/invoice` em ambiente local (ex.: `http://localhost:3001/...`), a tela exibia mensagem do gateway indicando que o host local não era permitido para a “site key/domínio”.

- **Causa raiz**  
  O proxy acabava repassando **páginas HTML do gateway** (ex.: `invoiceUrl`) em vez de servir o **PDF do boleto** (`bankSlipUrl`) ou uma UI própria. Essas páginas podem depender de validações de domínio e quebram em `localhost`.

- **Correção aplicada**  
  - Para **BOLETO**, o proxy passou a priorizar/servir somente o **PDF** (`bankSlipUrl`).
  - Para **PIX**, o proxy passou a retornar uma **página HTML própria** (no domínio do app) com QR Code e Pix Copia e Cola.
  - Na criação do pagamento, o campo `invoiceUrl` passou a preferir `bankSlipUrl` no caso de boleto e não salvar `invoiceUrl` do gateway para PIX/cartão.

- **Arquivos envolvidos**  
  - `src/app/api/payments/[paymentId]/invoice/route.ts`
  - `src/app/api/subscription/create/route.ts`

- **Status**: Resolvido.

## 2025-12-09 – Admin Catálogo não listava séries/animes corretamente

- **Sintoma**  
  Na página `/admin/catalog`, mesmo com filtro em "Todos os tipos", várias séries/animes não apareciam na lista/grade. O admin tinha a impressão de que só existiam alguns filmes.

- **Causa raiz**  
  A API `/api/titles` tem `limit` padrão de 24 itens. O `AdminCatalogPage` chamava `fetch("/api/titles")` sem parâmetros e fazia filtros/paginação apenas no cliente. Resultado:
  - Só os 24 títulos mais populares vinham do backend.
  - Depois disso, o filtro por tipo (MOVIE/SERIES/ANIME) era aplicado **em cima desse subset**, escondendo o resto do catálogo.

- **Correção aplicada**  
  No `AdminCatalogPage`, função `loadTitles`:
  - Passamos a chamar `fetch("/api/titles?limit=1000")` para carregar um volume grande de títulos de uma vez.
  - Mantida a paginação apenas no cliente (usando `itemsPerPage`).

- **Arquivos envolvidos**  
  - `src/app/admin/catalog/page.tsx`
  - (somente frontend; nenhuma mudança na rota `/api/titles`)

- **Status**: Resolvido. Catálogo agora enxerga filmes + séries + animes e os filtros funcionam em cima do conjunto completo carregado.

---

## 2025-12-09 – Jobs HLS falhando com fontes 10‑bit (x264 high profile)

- **Sintoma**  
  Jobs de transcodificação HLS apareciam em `/admin/jobs` com erro:

  ```
  ffmpeg falhou: x264 [error]: high profile doesn't support a bit depth of 10
  [libx264 @ ...] Error setting profile high.
  Error initializing output stream 0:0 -- Error while opening encoder for output stream #0:0
  ```

- **Causa raiz**  
  Alguns arquivos de origem eram 10‑bit (ex.: MKV 10‑bit). O transcoder usava `libx264` com:
  - `-profile:v:0 high` e sem especificar `-pix_fmt`.  
  Nessa combinação, o x264 herdava o bit depth da fonte (10‑bit) e tentava usar `profile=high`, que só suporta 8‑bit, gerando o erro acima.

- **Correção aplicada**  
  No serviço `flixcrd-transcoder`, dentro da função `_run_hls_job`, ajustamos o comando `ffmpeg` para forçar saída em 8‑bit:
  - Adicionamos antes dos `-c:v`:

    ```
    -pix_fmt yuv420p
    ```

  - Isso garante que a saída seja sempre 8‑bit 4:2:0, compatível com `profile high`, mesmo quando a fonte é 10‑bit.

- **Arquivos envolvidos**  
  - `flixcrd-transcoder/app/main.py`  
    - Seção do comando `ffmpeg` em `_run_hls_job`.

- **Status**: Resolvido (após deploy do transcoder atualizado na VPS e restart do serviço). Novos jobs HLS para fontes 10‑bit passam a completar normalmente.

---

## 2025-12-09 – Admin Subtitles não listava todas as séries/animes

- **Sintoma**  
  Na página `/admin/subtitles`, o select "Selecione uma série ou anime..." mostrava apenas parte das séries/animes do catálogo (ou, dependendo do contrato da API, podia aparecer vazio), dificultando usar o fluxo de legendas.

- **Causa raiz**  
  O componente `SubtitlesPage` assumia um contrato antigo da API `/api/titles`:
  - Fazia `fetch("/api/titles")` sem parâmetros de `limit`.
  - Interpretava a resposta como:
    - `Array.isArray(data) ? data : (data.titles || [])`
  - A API atual, porém, retorna **objeto paginado**:
    - `{ data: Title[], page, limit, total, totalPages }`.
  - Além disso, o `limit` padrão da rota é 24. Ou seja:
    - Só os 24 primeiros títulos voltavam do backend.
    - E o filtro por tipo (SERIES/ANIME) era feito em cima desse subset.

- **Correção aplicada**  
  No `SubtitlesPage`:
  - Alterado o fetch para pedir mais itens:
    - `GET /api/titles?limit=1000`.
  - Ajustado o parsing da resposta para suportar o formato paginado novo ou array direto:

    ```ts
    const data = await res.json();

    const allTitles = Array.isArray(data)
      ? data
      : Array.isArray((data as any).data)
      ? (data as any).data
      : [];

    const filtered = allTitles.filter(
      (t: any) => t.type === "SERIES" || t.type === "ANIME"
    );
    ```

- **Arquivos envolvidos**  
  - `src/app/admin/subtitles/page.tsx`

- **Status**: Resolvido. A tela de legendas agora consulta a API `/api/titles` usando o formato atual e um limite alto, de forma que todas as séries/animes cadastradas no catálogo passam a ficar disponíveis no select para gerenciamento de legendas.

---

## 2025-12-09 – Flag real de `hasSubtitle` por episódio em Admin Subtitles

- **Sintoma**  
  Mesmo após corrigir o carregamento de séries/animes em `/admin/subtitles`, a lista de episódios continuava marcando `hasSubtitle: false` para tudo (comentário `// TODO: verificar se já tem legenda`), sem refletir se já existia `.vtt` salvo no Wasabi.

- **Causa raiz**  
  A rota `/api/titles/[id]/seasons` retornava apenas dados de temporada/episódios vindos do banco (`hlsPath`, `episodeNumber`, etc.), mas **não fazia nenhuma verificação por arquivos de legenda**. O `SubtitlesPage` simplesmente fixava `hasSubtitle: false` ao montar a lista de episódios.

- **Correção aplicada**  
  1. **API – seasons com `hasSubtitle` calculado**  
     - Alterada a rota `GET /api/titles/[id]/seasons` para, além de buscar temporadas/episódios no Prisma, consultar o Wasabi para cada episódio:

       ```ts
       const seasons = await prisma.season.findMany({
         where: { titleId: id },
         orderBy: { seasonNumber: "asc" },
         include: {
           episodes: {
             orderBy: { episodeNumber: "asc" },
             select: {
               id: true,
               episodeNumber: true,
               name: true,
               overview: true,
               stillUrl: true,
               runtime: true,
               airDate: true,
               hlsPath: true,
             },
           },
         },
       });

       // Se não houver bucket configurado, retorna como antes
       if (!WASABI_BUCKET) {
         return NextResponse.json(seasons);
       }

       const seasonsWithSubtitles = await Promise.all(
         seasons.map(async (season) => {
           const episodesWithFlag = await Promise.all(
             (season.episodes ?? []).map(async (ep) => {
               let hasSubtitle = false;

               if (ep.hlsPath && ep.hlsPath.trim() !== "") {
                 try {
                   const prefix = ep.hlsPath.endsWith("/") ? ep.hlsPath : `${ep.hlsPath}/`;
                   const cmd = new ListObjectsV2Command({
                     Bucket: WASABI_BUCKET,
                     Prefix: prefix,
                     MaxKeys: 50,
                   });

                   const listed = await wasabiClient.send(cmd);
                   const contents = listed.Contents ?? [];
                   hasSubtitle = contents.some((obj) => {
                     const key = obj.Key ?? "";
                     return key.toLowerCase().endsWith(".vtt");
                   });
                 } catch (err) {
                   console.error("Erro ao verificar legendas para episódio", ep.id, err);
                 }
               }

               return {
                 ...ep,
                 hasSubtitle,
               };
             }),
           );

           return {
             ...season,
             episodes: episodesWithFlag,
           };
         }),
       );

       return NextResponse.json(seasonsWithSubtitles);
       ```

  2. **Client – `SubtitlesPage` consumindo `hasSubtitle` real**  
     - Ao montar o array de episódios, em vez de fixar `hasSubtitle: false`, passamos a usar o valor retornado pela API (fallback para `false` se não vier):

       ```ts
       const seasons = await res.json();

       const allEpisodes: Episode[] = [];
       for (const season of seasons) {
         if (season.episodes) {
           for (const ep of season.episodes) {
             allEpisodes.push({
               id: ep.id,
               name: ep.name,
               seasonNumber: season.seasonNumber,
               episodeNumber: ep.episodeNumber,
               hasSubtitle: Boolean((ep as { hasSubtitle?: boolean }).hasSubtitle), // TODO: verificar se já tem legenda
             });
           }
         }
       }
       ```

- **Arquivos envolvidos**  
  - `src/app/api/titles/[id]/seasons/route.ts`  
  - `src/app/admin/subtitles/page.tsx`

- **Status**: Resolvido. A tela de legendas agora recebe, para cada episódio, uma flag `hasSubtitle` baseada na existência de arquivos `.vtt` no Wasabi para o `hlsPath` daquele episódio, permitindo evoluções futuras de UI (badges, filtros, etc.) sem depender de valores fixos.

---

## 2025-12-09 – Catálogo público (/browse) limitado a 24 títulos

- **Sintoma**  
  Na página `/browse`, o contador mostrava `24 títulos` mesmo com muito mais itens cadastrados no banco. Rolando a página não carregava mais resultados e a grade ficava sempre presa a esse primeiro lote.

- **Causa raiz**  
  A API `/api/titles` também usa `limit` padrão de 24 itens. O `BrowseClient` fazia:
  - `fetch("/api/titles?...")` **sem** informar `page`/`limit`.
  - Interpretava a resposta tanto como array direto quanto como `{ data: [] }`, mas, na prática, sempre trazia só a primeira página (24 itens) e substituía o estado local por esse resultado.
  - Não havia paginação/infinite scroll real, então o catálogo público nunca passava do primeiro page de resultados.

- **Correção aplicada**  
  1. **API – permitir páginas maiores**  
     - Em `/api/titles`, o `pageSize` passou a ser calculado como:

       ```ts
       const limit = parseInt(searchParams.get("limit") || "24", 10);
       const pageSize = Math.min(limit, 200); // Max 200 para evitar respostas gigantes
       ```

     - Isso permite que clientes peçam páginas de até 200 itens.

  2. **Client – Browse com paginação + infinite scroll**  
     - No `BrowseClient`:
       - Definido `PAGE_SIZE = 48`.
       - `loadTitles(pageToLoad, reset)` agora envia sempre `page` e `limit` na query string e consome o campo `data` quando a resposta é paginada.
       - Ao mudar filtros / ordenação / busca, a lista é recarregada a partir da página 1.
       - Adicionado `IntersectionObserver` simples no final da grade para carregar automaticamente `page + 1` enquanto houver `hasMore`, criando um infinite scroll leve.

- **Arquivos envolvidos**  
  - `src/app/api/titles/route.ts`  
  - `src/app/browse/BrowseClient.tsx`

- **Status**: Resolvido. O catálogo público agora carrega o catálogo completo aos poucos (via páginas de 48 itens) e o contador deixa de ficar travado em 24 títulos.

---

## 2025-12-09 – Upload de arquivos grandes (> 5 GB) falhando no Wasabi

- **Sintoma**  
  Ao tentar subir arquivos grandes (ex.: ~9 GB) pelo fluxo `/admin/upload-v2`, o upload avançava até certo ponto e depois falhava com status `400` na requisição `PUT` para o Wasabi. Arquivos menores subiam normalmente.

- **Causa raiz**  
  O fluxo de upload v2 usava apenas **upload simples** (PUT único):
  - `POST /api/wasabi/upload-url` gerava uma URL assinada de `PUT` para o objeto inteiro.
  - O frontend fazia `xhr.send(uploadFile.file)` mandando o arquivo completo numa única requisição.
  - Em provedores S3-compatíveis (S3/Wasabi), uploads acima de ~5 GB devem obrigatoriamente usar **Multipart Upload**; PUT simples pode retornar erro do tipo `EntityTooLarge`.

- **Correção aplicada**  
  1. **Modo padrão passou a ser multipart**  
     - No `upload-v2`, introduzidas as constantes:

       ```ts
       const MULTIPART_THRESHOLD_BYTES = 0; // sempre multipart
       const MULTIPART_PART_SIZE_BYTES = 64 * 1024 * 1024; // 64 MB
       const MULTIPART_CONCURRENCY = 6; // 6 partes em paralelo
       const MULTIPART_MAX_RETRIES = 3; // tentativas por parte
       ```

     - Com `MULTIPART_THRESHOLD_BYTES = 0`, **todo arquivo** sobe via fluxo multipart.

  2. **Integração com as rotas multipart existentes**  
     - Criada a função `uploadMultipartFile(...)` no `upload-v2` que:
       - Chama `POST /api/wasabi/multipart/start` com `{ titleId, episodeId, filename, contentType }` para obter `{ uploadId, key }`.
       - Divide o `File` em partes de 64 MB e cria uma fila de partes.
       - Dispara até 6 workers concorrentes; cada worker:
         - Pede URL da parte em `POST /api/wasabi/multipart/part-url`.
         - Faz `PUT` da `blob` da parte nesse URL.
         - Tenta novamente até 3 vezes em caso de falha antes de abortar.
         - Atualiza `progress %`, `uploadSpeed`, `uploadedBytes` e `estimatedTimeLeft` no estado do arquivo.
       - Ao final, chama `POST /api/wasabi/multipart/complete` com a lista de partes `{ partNumber, eTag }` ordenadas.

  3. **Branch único em `uploadSingleFile`**  
     - Em `uploadSingleFile`, depois de toda a lógica de criar/buscar episódio, o código passou a chamar diretamente `uploadMultipartFile(...)` para qualquer arquivo, marcando o item como concluído ao final.

- **Arquivos envolvidos**  
  - `src/app/admin/upload-v2/page.tsx`  
  - (rotas multipart já existentes, agora efetivamente utilizadas pelo fluxo):
    - `src/app/api/wasabi/multipart/start/route.ts`  
    - `src/app/api/wasabi/multipart/part-url/route.ts`  
    - `src/app/api/wasabi/multipart/complete/route.ts`

- **Status**: Resolvido. Uploads grandes (incluindo arquivos de 9 GB ou mais) agora utilizam multipart upload concorrente com retries por parte, tornando o fluxo mais rápido e resiliente a falhas de rede.
