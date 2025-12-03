# 📺 Séries / Animes / Doramas – Design de Temporadas e Episódios

## 1. Fonte de dados (TMDB)

Usar **apenas TMDB** como fonte principal para séries, animes e doramas (todos via API de `tv`).

- **Detalhes da série**  
  `GET https://api.themoviedb.org/3/tv/{tv_id}?language=pt-BR`
  - Retorna temporadas (`seasons`), cada uma com:
    - `season_number`
    - `episode_count`
    - `poster_path`

- **Detalhes de uma temporada específica**  
  `GET https://api.themoviedb.org/3/tv/{tv_id}/season/{season_number}?language=pt-BR`
  - Retorna lista de **episódios** com, para cada item:
    - `id` (TMDB episode id)
    - `episode_number`
    - `season_number`
    - `name`
    - `overview`
    - `air_date`
    - `runtime`
    - `still_path`

Obs.: Anime e dorama também aparecem como `tv` no TMDB, então o mesmo fluxo funciona.


## 2. Modelo de dados (Prisma)

### 2.1. `Title` continua como “obra principal”

- Filmes → `Title` único, como já é hoje.
- Séries / animes / doramas → um `Title` representa a **série completa** (ex.: "Breaking Bad", "Jujutsu Kaisen").

Campo existente `Title.type` continua sendo usado:

- `MOVIE` – filme
- `SERIES` – série live action
- `ANIME` – anime
- `OTHER` – fallback (pode ser dorama se não quiser tipo separado)

### 2.2. Novos modelos: `Season` e `Episode`

```prisma
model Season {
  id           String   @id @default(cuid())
  titleId      String
  seasonNumber Int
  name         String?
  overview     String?
  airDate      DateTime?
  posterUrl    String?
  episodeCount Int?

  title    Title    @relation(fields: [titleId], references: [id], onDelete: Cascade)
  episodes Episode[]

  @@unique([titleId, seasonNumber])
}

model Episode {
  id            String   @id @default(cuid())
  titleId       String        // série/anime/dorama (Title)
  seasonId      String?
  tmdbId        Int?          // TMDB episode id
  seasonNumber  Int
  episodeNumber Int
  name          String
  overview      String?
  airDate       DateTime?
  runtime       Int?
  stillUrl      String?
  hlsPath       String?       // ex.: titles/slug/s1/e01/
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  title  Title  @relation(fields: [titleId], references: [id], onDelete: Cascade)
  season Season? @relation(fields: [seasonId], references: [id])

  @@unique([titleId, seasonNumber, episodeNumber])
}
```

Com isso:

- `Title` representa a série inteira.
- `Season` guarda metadados da temporada (poster, overview, número, contagem de episódios).
- `Episode` guarda metadados específicos do episódio + `hlsPath` próprio.


## 3. Fluxo inteligente no painel admin

### 3.1. Criar a série (Title)

Na página `/admin/catalog` (que já existe):

1. Admin busca no TMDB (rota atual `/api/tmdb/search`).
2. Ao criar `Title`:
   - Se for filme → fluxo atual (apenas `Title`).
   - Se for série/anime/dorama → salvar `Title` com:
     - `type = SERIES` ou `ANIME` (ou `OTHER` se dorama),
     - `tmdbId` da série (TV id do TMDB).

### 3.2. Nova aba "Temporadas & Episódios" no admin do título

Na tela de edição `/admin/catalog/[id]`, se `Title.type` for série/anime/dorama:

- Mostrar painel com:
  - Lista de temporadas vinda do TMDB (`/tv/{tmdbId}`):
    - S01 – N episódios
    - S02 – N episódios
    - ...
  - Para cada temporada:
    - Botão **"Importar temporada X"**
  - Botão global **"Importar todas as temporadas"**.

### 3.3. Ação "Importar temporada" (backend)

Nova rota admin, por exemplo:

- `POST /api/admin/titles/[id]/import-season`
  - Body: `{ seasonNumber: number }`
  - Passos:
    1. Busca `Title` no banco, lê `tmdbId`.
    2. Chama TMDB: `GET /tv/{tmdbId}/season/{seasonNumber}?language=pt-BR`.
    3. Cria ou atualiza `Season` correspondente.
    4. Para cada episódio retornado:
       - Cria/atualiza `Episode` com `tmdbId`, `seasonNumber`, `episodeNumber`, `name`, `overview`, `airDate`, `runtime`, `stillUrl`.
       - Seta `hlsPath` padrão, ex.: `titles/{slug}/s{seasonNumber}/e{episodeNumber}/`.

- Opcional: `POST /api/admin/titles/[id]/import-all-seasons` que repete esse fluxo para todas as temporadas conhecidas.

### 3.4. Upload / HLS focado em episódios

Evolução da tela `/admin/upload`:

- Além de listar apenas `Title`, permitir selecionar **episódios**:
  - Selecionar `Title` → carregar temporadas/episódios daquele título.
  - Escolher episódio alvo → definir upload para o `hlsPath` daquele episódio.

Fluxo:

1. Admin seleciona episódio (ex.: S01E03).
2. Faz upload de um arquivo fonte (`.mkv`, `.mp4`, etc.) para um prefixo temporário ou direto para `Episode.hlsPath`.
3. Dispara job no transcoder via `/api/transcode/hls/[episodeId]` (ou reuso da rota atual, passando o prefixo do episódio).
4. Ao terminar, o HLS daquele episódio está em `Episode.hlsPath` (ex.: `titles/slug/s1/e03/master.m3u8` + segments).

### 3.5. UI para o usuário final

#### Página de detalhes `/title/[id]`

Se o `Title.type` for filme:

- Fluxo atual (botão "Assistir", Minha Lista, etc.).

Se for série/anime/dorama:

- Manter hero rico (backdrop, sinopse, elenco, etc.).
- Abaixo do hero, mostrar:
  - **Lista de temporadas** (tabs ou select):
    - S01, S02, S03...
  - Para a temporada selecionada, listar episódios:
    - Número + nome (`S01E03 – Nome do episódio`).
    - Sinopse curta.
    - Imagem (`stillUrl`) se existir.
    - Badge de progresso (integrado ao `PlaybackProgress` se você quiser no futuro).
    - Botão **"Assistir"** → vai para `/watch/[episodeId]`.

#### Player `/watch/[id]`

- Em vez de tocar só `Title.hlsPath`, para episódios você passa:
  - `episodeId`.
  - Backend de playback (`/api/episodes/[id]/playback` ou reutilizar `/api/titles/[id]/playback` adaptado) pega o `Episode.hlsPath`.
- O `PlaybackProgress` pode ser estendido para salvar por episódio:
  - Adicionar `episodeId` (ou uma tabela paralela `EpisodePlaybackProgress`).


## 4. Outras possíveis fontes além do TMDB (se um dia precisar)

Por enquanto a recomendação é **ficar só no TMDB**. Alternativas futuras:

- **TVDB** – muito bom em granularidade de episódios, mas com licenciamento mais chato.
- **AniList / MyAnimeList / AniDB** – bons para anime, com modelos ricos.

Mas como o projeto já está fortemente baseado em TMDB, a melhor estratégia agora é:

- Filmes → `movie` API (como já é hoje).
- Séries / animes / doramas → `tv` + `tv/{id}/season/{n}` para temporadas/episódios.
