# 🎬 Arquitetura de Streaming HLS estilo Netflix  
## Usando Next.js (Vercel) + Wasabi S3 + HLS (.m3u8) + Presigned URLs

## 📌 Objetivo
Criar um sistema de streaming estilo Netflix, com qualidade adaptativa, thumbnails, catálogo organizado e player otimizado, usando:
- **Next.js (deploy no Vercel)** para frontend e API routes leves
- **Wasabi S3** para armazenamento e entrega de vídeos
- **HLS (.m3u8)** para streaming adaptativo
- **hls.js** como player no navegador
- **Presigned URLs** para proteger vídeos privados

O projeto deve ser modular, escalável, performático e barato.

---

# 🚀 1. Arquitetura Geral

Usuário → Next.js (Vercel) → Player HLS → Wasabi (HLS segments .ts + manifest .m3u8)

- O **Vercel não serve vídeos**, apenas a interface e as páginas.
- O **Wasabi entrega os vídeos diretamente**, suportando `Range` e grandes arquivos.
- O vídeo é convertido para HLS com vários níveis de qualidade.
- O player do navegador usa o arquivo `.m3u8` carregado via `hls.js`.

---

# 🗃️ 2. Estrutura dos Arquivos no Wasabi

Cada vídeo deve ter sua pasta contendo:

movie-id/
  master.m3u8
  720p.m3u8
  480p.m3u8
  360p.m3u8
  segments/
      seg1.ts
      seg2.ts
      seg3.ts
      ...
  thumbnail.jpg
  poster.jpg
  metadata.json

---

# 🎞️ 3. Conversão de Vídeo para HLS

ffmpeg -i input.mp4 \
  -profile:v baseline -level 3.0 \
  -start_number 0 \
  -hls_time 6 \
  -hls_list_size 0 \
  -f hls master.m3u8

Conversão multi-quality está no arquivo original enviado.

---

# 🧩 4. Player HLS no Next.js

Hoje o player é um **client component** (`WatchClient`) em `/watch/[id]`, alimentado por uma rota
de backend `/api/titles/[id]/playback`.

Fluxo:

1. A página server-side `/watch/[id]` busca os dados do título e chama a API de playback.
2. A API decide se o título deve tocar via **HLS** ou em modo **progressive fallback**
   (MP4/MOV/WEBM/AVI) com base nos arquivos encontrados no prefixo do Wasabi.
3. O `WatchClient` recebe:
   - `kind`: `"hls"` ou `"progressive"`.
   - `playbackUrl`: URL assinada para `master.m3u8` ou para o arquivo de vídeo.
   - `subtitles`: lista de trilhas de legenda externas (`.vtt`) também assinadas.

Funcionalidades do player:

- `hls.js` para tocar `.m3u8` com fallback nativo em browsers que já suportam HLS.
- **Atalhos de teclado** (espaço, setas, `F` para fullscreen, etc.).
- **Auto-hide de controles** após alguns segundos sem interação.
- **Seleção de qualidade** (troca de `level` do `hls.js`).
- **Seleção de faixa de áudio e legenda** quando existirem múltiplas trilhas.
- Suporte a **legendas externas** (arquivos `.vtt` no Wasabi) e a legendas baixadas
  automaticamente do OpenSubtitles via `/api/subtitles/fetch/[id]`.

---

# 🔐 5. Presigned URLs

Os vídeos e legendas ficam em um bucket **privado** no Wasabi. A aplicação Next.js nunca expõe
as credenciais diretamente, apenas **URLs temporárias assinadas**.

Principais pontos:

- Rota `/api/titles/[id]/playback`:
  - Lista os objetos do prefixo `hlsPath` no Wasabi.
  - Decide o `kind` (`hls` ou `progressive`).
  - Gera URLs assinadas para:
    - Playlist HLS (manifest `.m3u8`) ou arquivo de vídeo.
    - Legendas externas `.vtt` associadas ao título.
- HLS:
  - A playlist pode ser servida por uma rota Next que reescreve o manifest com URLs assinadas
    para os segmentos, ou o próprio manifest pode conter URLs absolutas presignadas do Wasabi.
  - Os segmentos (`.ts`) são entregues diretamente pelo Wasabi usando essas URLs temporárias.
- Progressivo:
  - Um único objeto grande (ex.: `.mp4`) é exposto via URL assinada, respeitando `Range`.

Com isso, o **Vercel** serve apenas HTML/JS/CSS e manifests leves, enquanto o tráfego pesado de
vídeo vem direto do Wasabi.

---

# 🎛️ 6. Painel Administrativo

O painel admin (`/admin`) é acessível apenas para usuários com `role = ADMIN` (NextAuth +
middleware). Ele hoje tem as seguintes seções principais:

## 6.1. Dashboard / Navegação

- Sidebar com links para:
  - **Dashboard**
  - **Catálogo** (`/admin/catalog`)
  - **Upload / HLS** (`/admin/upload`)
  - **Jobs HLS** (`/admin/jobs`)
  - **Usuários/Assinaturas** (`/admin/users`)
- Rodapé da sidebar com botões:
  - `Ir para PaelFlix` → volta para a home pública (`/`) **sem deslogar**.
  - `Sair` → `signOut` com redirect para `/login`.

## 6.2. Catálogo (Titles + TMDB)

Página `/admin/catalog` com:

- Busca no TMDB via `/api/tmdb/search`.
- Aplicar resultado em um formulário de título.
- Ao criar título novo, o admin hoje só precisa de:
  - `tmdbId`
  - `type` (`MOVIE` / `SERIES`)
- A rota `POST /api/titles` busca **todos os metadados do TMDB** automaticamente:
  - Detalhes do filme/série.
  - Gêneros.
  - Elenco (cast).
  - Equipe técnica (crew – diretor, roteirista, produtor, etc.).
  - Vídeos (trailers/clipes YouTube).
- Ao editar um título, o admin ainda pode ajustar campos manuais (nome, slug, sinopse,
  datas, imagens, etc.).
- A lista de títulos mostra:
  - Nome, tipo, slug, `tmdbId`, `hlsPath`.
  - Ações:
    - `Editar` título.
    - `Baixar legenda PT-BR` (chama OpenSubtitles e sobe `.vtt` pro Wasabi).
    - `Gerar HLS` (quando ainda não existe playlist `.m3u8` detectada).
    - `HLS pronto` (badge quando já há `.m3u8` no prefixo – checado via
      `/api/admin/titles/[id]/hls-status`).
    - `Excluir` (apaga título e objetos associados no Wasabi).
- Botão global `Atualizar TMDb de todos`:
  - Chama `POST /api/admin/titles/refresh-tmdb`.
  - Re-sincroniza detalhes, gêneros, elenco, crew e vídeos para todos os títulos que possuem `tmdbId`.

## 6.3. Upload / HLS (`/admin/upload`)

Responsável por enviar **arquivos de vídeo** (ou pacotes HLS) para o Wasabi e vincular ao título:

- Lista de títulos para escolher (`/api/titles`).
- Upload inteligente:
  - Usa upload simples (`PUT` direto) ou multipart (dividindo em partes) via rotas
    `/api/wasabi/upload-url` e `/api/wasabi/multipart/*`.
  - Atualiza progresso visual.
  - Ao terminar, atualiza o campo `hlsPath` do título com o prefixo usado
    (`titles/<slug-do-titulo>/`).

## 6.4. Jobs de Transcodificação (`/admin/jobs`)

- Permite acompanhar jobs de transcodificação HLS que estão rodando no **serviço Python FastAPI**.
- Polling em `/api/transcode/hls/[id]` com `job_id` para obter status, progresso (%) e mensagens.
- Quando o job conclui, o HLS fica disponível no Wasabi sob o prefixo do título.

## 6.5. Usuários / Assinaturas (`/admin/users`)

- Lista usuários com:
  - Email, nome, role, data de criação.
- Permite editar `role` (`USER`/`ADMIN`) com proteção para não remover o próprio admin.
- Está pronto para ser ligado a um sistema de **assinaturas** (tabela `Subscription`).

---

# 🧱 7. Interface estilo Netflix

A página inicial (`/`) é hoje uma **home pública dinâmica**, com suporte a login e busca.

Principais elementos:

- **Hero**: título mais popular (ordenado por `popularity` no Prisma).
  - Mostra backdrop, nome, ano, rating (★) e sinopse.
  - Botões:
    - `Assistir` (leva para `/title/[id]`, onde o usuário pode clicar em "Assistir agora" e ir para `/watch/[id]`).
    - `Mais informações` (vai para `/title/[id]`, página de detalhes rica em metadados TMDB).
- **Header**:
  - Logo `PaelFlix` à esquerda.
  - Campo de **busca** no topo (estilo Netflix) usando `/api/titles?q=...` com debounce.
  - Botões à direita:
    - `Painel Admin` (somente para `role = ADMIN`).
    - `Entrar` / `Sair` dependendo da sessão.
- **Busca dinâmica**:
  - Digitou → espera 400ms → chama `/api/titles?q=...`.
  - Exibe seção `Resultados para "..."` com grid de posters.
  - Enquanto há busca ativa, os carrosséis por gênero somem.
- **Carrosséis por gênero** (somente logado):
  - Usa `/api/genres` + `/api/genres/[id]/titles`.
  - Até ~6 gêneros com carrosséis horizontais scrolláveis.
- Visitante não logado vê um bloco de **CTA** convidando a entrar para ver o catálogo completo.

Funcionalidades adicionais da UI já implementadas por usuário:

- Página de **detalhes do título** (`/title/[id]`):
  - Usa todos os metadados do TMDB (gêneros, elenco, crew, trailers, rating, runtime, países/idiomas).
  - Exibe hero com backdrop/poster, sinopse, tagline, status, etc.
  - Botões "Assistir agora", "Voltar para início" e "Adicionar à Minha lista".
- Sessão **"Minha lista"**:
  - Usa a tabela `UserFavorite` para ligar usuários a títulos favoritos.
  - Mostra um carrossel "Minha lista" na home, apenas para usuários logados.
- Sessão **"Continuar assistindo"**:
  - Usa a tabela `PlaybackProgress` para guardar posição/duração por título e usuário.
  - O player `/watch/[id]` busca o progresso salvo e retoma do ponto onde o usuário parou.
  - A home mostra um carrossel "Continuar assistindo" com barra de progresso.

---

# 📡 8. Banco de Dados (Prisma + PostgreSQL)

Principais modelos atuais:

- `User`:
  - Autenticação por email/senha (NextAuth Credentials).
  - Campo `role` (`USER`/`ADMIN`).
  - Relação com favoritos (`favorites`) e progresso de playback (`playbackProgress`).
- `Subscription`:
  - Estado da assinatura do usuário (pensado para integração futura com Stripe/PagSeguro).
- `Title`:
  - Tipo (`MOVIE`, `SERIES`, `ANIME`, `OTHER`).
  - `tmdbId`, `slug`, `name`, `overview`, `tagline`.
  - Datas, imagens (`posterUrl`, `backdropUrl`, `logoUrl`).
  - Campos de rating e popularidade (`voteAverage`, `voteCount`, `popularity`).
  - Campos de produção (`status`, `originalLanguage`, `spokenLanguages`, `productionCountries`).
  - `hlsPath`: prefixo no Wasabi onde vivem vídeo/playlist HLS.
  - Relações com gêneros, elenco, crew, trailers (`videos`), favoritos (`favoritedBy`) e progresso (`playbackProgress`).
- `Genre` + `TitleGenre`:
  - Gêneros do TMDB com relação N:N para `Title`.
- `Cast`:
  - Elenco principal (top 20) com personagem, ordem e foto.
- `Crew`:
  - Diretor, roteiristas, produtores, etc.
- `Video`:
  - Trailers, teasers e clipes (ex.: YouTube) do TMDB.
- `UserFavorite`:
  - Liga usuários a títulos marcados em **"Minha lista"**.
  - Garante unicidade por (`userId`, `titleId`).
- `PlaybackProgress`:
  - Guarda `positionSeconds` e `durationSeconds` por (`userId`, `titleId`).
  - Alimenta a seção **"Continuar assistindo"** e a retomada automática no player.

Esse esquema permite construir uma UI rica (detalhes por título, filtros por gênero, favoritos,
"continuar assistindo", mostrar atores/diretores, etc.).

---

# 💰 9. Custos

Resumo de custos e trade-offs da arquitetura atual:

- **Wasabi S3**:
  - Armazenamento barato de grandes volumes de vídeo.
  - Custo principal vem de **egress** (download dos segmentos pelos usuários).
- **Vercel / Next.js**:
  - Custos ligados a funções serverless (rotas `/api`) e tráfego de HTML/JS/CSS.
  - Como o vídeo vai direto do Wasabi, o impacto de bandwidth no Vercel é bem menor.
- **Transcoder FastAPI (Python)**:
  - Roda em VM/contêiner separado.
  - Custo proporcional a CPU/RAM e tempo de transcodificação (ffmpeg é pesado, mas isolado).
- **APIs externas**:
  - TMDB e OpenSubtitles têm limites gratuitos generosos, mas é preciso gerenciar chaves
    de API com cuidado (nunca commitar `.env`).

Em conjunto, a arquitetura é pensada para ser **barata mas escalável**: Vercel cuida da
experiência web, Wasabi assume o tráfego de mídia, e o transcoder roda onde for mais conveniente.

---

# 🏁 10. Resultado Final & Próximos Passos

## 10.1. Já implementado

- Autenticação com NextAuth (credenciais) + roles (`USER`/`ADMIN`).
- Proteção de rotas (`/admin`, `/watch`, `/title`) via middleware.
- Upload de vídeos para Wasabi (simples + multipart) com progresso.
- Serviço de transcodificação HLS externo (FastAPI + ffmpeg) integrado via `/api/transcode/hls/*`.
- Geração e uso de HLS multi-quality com player `hls.js` avançado (atalhos, qualidade, legendas).
- Integração com TMDB para criar títulos completos (gêneros, elenco, crew, trailers).
- Botão de **refresh global** de metadados TMDB.
- Integração com OpenSubtitles para buscar, converter (SRT→VTT) e subir legendas para Wasabi.
- Painel admin completo (catálogo, upload, jobs, usuários) com botão de ida/volta para a home.
- Home pública estilo Netflix com hero dinâmico, carrosséis por gênero e busca dinâmica.
 - Página de **detalhes do título** em `/title/[id]` usando todos os metadados TMDB
   (gêneros, elenco, crew, vídeos, idiomas, países, rating, runtime).
 - **Minha lista / favoritos** por usuário (`UserFavorite`), com botão na página de detalhes e
   carrossel "Minha lista" na home para usuários logados.
 - **Continuar assistindo** por usuário (`PlaybackProgress`), salvando posição de playback em
   `/watch/[id]` e exibindo carrossel dedicado na home com barra de progresso.

## 10.2. O que ainda falta (roadmap imediato)

1. **Assinaturas de verdade**:
   - Integrar `Subscription` com gateway de pagamento.
   - Bloquear conteúdo premium para usuários sem `status = ACTIVE`.

2. **Observabilidade e DX em produção**:
   - Centralizar logs do transcoder FastAPI (jobs HLS) e do Next.js em um stack de observabilidade
     (ex.: CloudWatch, Loki, ELK, etc.).
   - Alertas básicos para falhas de transcodificação, falta de HLS em títulos publicados, etc.

Esses pontos completam a experiência "Netflix-like" em cima da arquitetura que já está
funcionando.

---

# 🔧 11. `.env`, Deploy e Observabilidade

## 11.1. Variáveis de ambiente – Next.js (`flixcrd-web`)

Arquivo recomendado: `.env.local` na raiz de `flixcrd-web` (e as mesmas chaves configuradas no
painel do Vercel):

```env
# Banco de dados
DATABASE_URL=postgresql://user:password@host:5432/crdflix_db

# Autenticação (NextAuth)
NEXTAUTH_SECRET=chave-aleatoria-bem-grande
# Em produção, também configure NEXTAUTH_URL=https://seu-dominio.com

# TMDB (catálogo rico)
TMDB_API_KEY=xxxxxxx

# OpenSubtitles (legendas automáticas)
OPENSUBTITLES_API_KEY=xxxxxxx

# Wasabi (armazenamento de vídeos/legendas)
WASABI_ACCESS_KEY_ID=xxxx
WASABI_SECRET_ACCESS_KEY=xxxx
WASABI_ENDPOINT=https://s3.your-region.wasabisys.com
WASABI_REGION=us-east-1
WASABI_BUCKET_NAME=flixcrd-videos

# Transcoder FastAPI (serviço externo de HLS)
TRANSCODER_BASE_URL=https://transcoder.seu-dominio-ou-ip.com
```

## 11.2. Variáveis de ambiente – Transcoder FastAPI (`flixcrd-transcoder`)

Na pasta `flixcrd-transcoder`, criar um arquivo `.env` com as mesmas credenciais do Wasabi:

```env
WASABI_ACCESS_KEY_ID=xxxx
WASABI_SECRET_ACCESS_KEY=xxxx
WASABI_ENDPOINT=https://s3.your-region.wasabisys.com
WASABI_REGION=us-east-1
```

O transcoder lê esse `.env` automaticamente (`load_dotenv`) e usa essas variáveis para gerar URLs
assinadas de leitura/escrita no Wasabi durante a transcodificação.

## 11.3. Deploy recomendado (resumo)

- **Banco de dados**:
  - Provisionar um PostgreSQL gerenciado (Railway, Supabase, RDS, etc.).
  - Configurar `DATABASE_URL` e rodar `npx prisma db push` uma vez para criar o schema.

- **Transcoder FastAPI**:
  - Subir em uma VM/contêiner dedicado (Docker + `uvicorn`), com acesso à internet e ao Wasabi.
  - Comando típico (exemplo):

    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000
    ```

  - Expor o serviço atrás de um reverse proxy (Nginx, Traefik, etc.) e apontar
    `TRANSCODER_BASE_URL` para esse endpoint público.

- **Next.js / Vercel**:
  - Importar o projeto `flixcrd-web` no Vercel.
  - Configurar todas as variáveis de ambiente da seção 11.1.
  - Certificar-se de que o banco e o transcoder estão acessíveis a partir do ambiente do Vercel.

## 11.4. Observabilidade & logs

Estado atual:

- **Next.js / API Routes**:
  - Logs de erro são feitos via `console.error` em rotas críticas
    (`/api/transcode/hls`, `/api/titles/[id]/playback`, `/api/subtitles/fetch`, etc.).
  - Em produção (Vercel), esses logs aparecem diretamente no painel de logs do projeto.
- **Transcoder FastAPI**:
  - Usa `print` e logging básico para avisar sobre credenciais faltando e erros de ffmpeg/Wasabi.
  - Jobs HLS mantêm um estado em memória (`JOBS`) com `status`, `progress` e `message`, acessível
    via `/jobs` e `/jobs/{job_id}`.

Melhorias futuras possíveis:

- Integrar os logs do transcoder a um serviço central (CloudWatch, Loki, ELK, etc.).
- Criar métricas simples (número de jobs em erro, tempo médio por job, etc.).
- Adicionar alertas quando um job ficar muito tempo em `RUNNING` ou falhar repetidamente.
