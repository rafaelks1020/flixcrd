# FlixCRD – Bugfix Log

Arquivo dedicado para registrar **todas as correções de bugs** feitas no sistema.

Regras de uso:
- Sempre que um bug for corrigido (backend, admin, app, transcoder, infra ligada ao app), registrar aqui.
- Registrar: data, contexto, sintomas, causa raiz, mudança aplicada e arquivos afetados.
- Não registrar ajustes puramente visuais sem impacto funcional.

---

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
