# Fase A: backend de música

Implementado em 07/11/2026, sem executar migrations no banco e sem alterar a fonte pmusic.

## Acesso e comportamento

- `M`: `requireMusicAccess()` em cada método. Sem sessão: 401. ADMIN passa. Demais usuários precisam de `hasActiveSubscription(userId)`, caso contrário: 403.
- `A`: `requireAdmin()` do Pflix em cada método. Retorno nulo vira 401 sem sessão ou 403 para usuário autenticado sem papel ADMIN.
- `L`: leitura de playlist por dono, colaborador editor/viewer ou playlist pública, sempre após M. Falha retorna 404 para evitar revelar playlists privadas.
- `E`: escrita de playlist por dono ou colaborador editor, sempre após M. Viewer e acesso público não autorizam escrita. Exclusão da playlist exige dono.
- Favoritos, histórico e listas privadas usam exclusivamente o userId da sessão. O cliente não escolhe o proprietário.
- Faixas retornam `streamUrl` e nunca `audioUrl`. A serialização também protege faixas aninhadas e respostas administrativas.
- Stream confere `music/`, recusa caminhos inseguros e retorna 302 com URL de uma hora. Histórico incrementa playCount em transação, junto do registro.
- Charts preservam metadados do Deezer. streamUrl é nulo quando não há faixa correspondente no catálogo; previews externos não são expostos.
- Letras preservam consulta LRCLIB com fallback e cache nos campos Track.lyricsLrc/lyricsPlain.
- Upload valida tipos, limites de texto, MIME, extensão e relações. Capas usam music/covers/. O trackId opcional precisa existir e pertencer ao álbum informado.
- Importação de imagens MusicBrainz limita tamanho e provedores HTTPS, validando também os redirecionamentos. Provedores não permitidos retornam apenas a URL de origem, sem importação.

## Arquivo existente alterado

- [prisma/schema.prisma:457](prisma/schema.prisma:457): cinco relações adicionadas ao User.
- [prisma/schema.prisma:595](prisma/schema.prisma:595): dois enums e oito modelos de música. Modelos anteriores preservados.

## Rotas criadas

Todos os caminhos abaixo começam em `/api/`. Cada linha também identifica o arquivo criado.

| Rota | Métodos e checagem | Arquivo |
| --- | --- | --- |
| `/api/music/catalog/albums` | GET: M | [src/app/api/music/catalog/albums/route.ts:5](src/app/api/music/catalog/albums/route.ts:5) |
| `/api/music/catalog/play-context` | GET: M | [src/app/api/music/catalog/play-context/route.ts:6](src/app/api/music/catalog/play-context/route.ts:6) |
| `/api/music/catalog/radio` | GET: M | [src/app/api/music/catalog/radio/route.ts:6](src/app/api/music/catalog/radio/route.ts:6) |
| `/api/music/catalog/search` | GET: M | [src/app/api/music/catalog/search/route.ts:5](src/app/api/music/catalog/search/route.ts:5) |
| `/api/music/charts` | GET: M | [src/app/api/music/charts/route.ts:47](src/app/api/music/charts/route.ts:47) |
| `/api/music/favorites` | GET: M + userId da sessão; POST: M + userId da sessão; DELETE: M + userId da sessão | [src/app/api/music/favorites/route.ts:6](src/app/api/music/favorites/route.ts:6) |
| `/api/music/history` | GET: M + userId da sessão; POST: M + userId da sessão | [src/app/api/music/history/route.ts:6](src/app/api/music/history/route.ts:6) |
| `/api/music/lyrics` | GET: M | [src/app/api/music/lyrics/route.ts:21](src/app/api/music/lyrics/route.ts:21) |
| `/api/music/playlists/[playlistId]` | GET: M + L; PUT: M + E; DELETE: M + dono | [src/app/api/music/playlists/[playlistId]/route.ts:6](src/app/api/music/playlists/[playlistId]/route.ts:6) |
| `/api/music/playlists/[playlistId]/tracks` | GET: M + L; POST: M + E; DELETE: M + E | [src/app/api/music/playlists/[playlistId]/tracks/route.ts:7](src/app/api/music/playlists/[playlistId]/tracks/route.ts:7) |
| `/api/music/playlists` | GET: M + userId da sessão; POST: M + userId da sessão | [src/app/api/music/playlists/route.ts:6](src/app/api/music/playlists/route.ts:6) |
| `/api/music/radio` | GET: M | [src/app/api/music/radio/route.ts:6](src/app/api/music/radio/route.ts:6) |
| `/api/music/recommendations` | GET: M + userId da sessão | [src/app/api/music/recommendations/route.ts:6](src/app/api/music/recommendations/route.ts:6) |
| `/api/music/search` | GET: M | [src/app/api/music/search/route.ts:5](src/app/api/music/search/route.ts:5) |
| `/api/music/tracks/[id]/stream` | GET: M + assertMusicKey | [src/app/api/music/tracks/[id]/stream/route.ts:6](src/app/api/music/tracks/[id]/stream/route.ts:6) |
| `/api/admin/music/albums/[albumId]` | GET: A; PUT: A; DELETE: A | [src/app/api/admin/music/albums/[albumId]/route.ts:6](src/app/api/admin/music/albums/[albumId]/route.ts:6) |
| `/api/admin/music/albums` | GET: A; POST: A | [src/app/api/admin/music/albums/route.ts:6](src/app/api/admin/music/albums/route.ts:6) |
| `/api/admin/music/artists/[artistId]` | GET: A; PUT: A; DELETE: A | [src/app/api/admin/music/artists/[artistId]/route.ts:6](src/app/api/admin/music/artists/[artistId]/route.ts:6) |
| `/api/admin/music/artists` | GET: A; POST: A | [src/app/api/admin/music/artists/route.ts:6](src/app/api/admin/music/artists/route.ts:6) |
| `/api/admin/music/musicbrainz/enrich` | POST: A | [src/app/api/admin/music/musicbrainz/enrich/route.ts:6](src/app/api/admin/music/musicbrainz/enrich/route.ts:6) |
| `/api/admin/music/tracks/[trackId]` | GET: A; PUT: A; DELETE: A | [src/app/api/admin/music/tracks/[trackId]/route.ts:6](src/app/api/admin/music/tracks/[trackId]/route.ts:6) |
| `/api/admin/music/tracks/from-id3` | POST: A | [src/app/api/admin/music/tracks/from-id3/route.ts:6](src/app/api/admin/music/tracks/from-id3/route.ts:6) |
| `/api/admin/music/tracks` | GET: A; POST: A | [src/app/api/admin/music/tracks/route.ts:6](src/app/api/admin/music/tracks/route.ts:6) |
| `/api/admin/music/upload/presign` | POST: A | [src/app/api/admin/music/upload/presign/route.ts:7](src/app/api/admin/music/upload/presign/route.ts:7) |

## Demais arquivos criados

- [src/lib/music/__tests__/security.test.ts:1](src/lib/music/__tests__/security.test.ts:1): 72 testes de acesso, IDOR, isolamento, chaves, stream, upload e histórico.
- [src/lib/music/access.ts:1](src/lib/music/access.ts:1): sessão next-auth e assinatura Pflix.
- [src/lib/music/admin-input.ts:1](src/lib/music/admin-input.ts:1): validação e preservação dos campos opcionais na edição.
- [src/lib/music/catalog-db.ts:1](src/lib/music/catalog-db.ts:1): consultas Prisma e DTOs do catálogo.
- [src/lib/music/errors.ts:1](src/lib/music/errors.ts:1): erro HTTP tipado.
- [src/lib/music/http.ts:1](src/lib/music/http.ts:1): validação manual, erros HTTP, serialização e imagens.
- [src/lib/music/import-image.ts:1](src/lib/music/import-image.ts:1): importação de imagem limitada por tamanho e provedor.
- [src/lib/music/lrc-parser.ts:1](src/lib/music/lrc-parser.ts:1): parser LRC portado.
- [src/lib/music/musicbrainz.ts:1](src/lib/music/musicbrainz.ts:1): consultas, cache e limitação de chamadas do pmusic.
- [src/lib/music/playlists.ts:1](src/lib/music/playlists.ts:1): regras de dono, editor e viewer.
- [src/lib/music/storage.ts:1](src/lib/music/storage.ts:1): chaves music/ e assinaturas Wasabi.
- [prisma/migrations/20261107173746_add_music/migration.sql:1](prisma/migrations/20261107173746_add_music/migration.sql:1): SQL gerado com prisma migrate diff, partindo de git show HEAD:prisma/schema.prisma. Apenas estruturas de música e suas chaves estrangeiras.
- [docs/FASE-A-MUSICA.md:1](docs/FASE-A-MUSICA.md:1): este inventário de entrega.

## Verificações

- `npx prisma generate`: passou. Necessário para conferir os novos tipos Prisma.
- `npx tsc --noEmit`: passou, zero erros.
- `NEXT_IGNORE_INCORRECT_LOCKFILE=1 npx jest src/lib/music/__tests__/security.test.ts --runInBand`: 72 testes passaram.
- Auditoria do schema: todos os modelos/enums anteriores conferidos contra HEAD; somente as relações autorizadas foram adicionadas ao User.
- Auditoria SQL: oito CREATE TABLE, dois CREATE TYPE, índices e ADD CONSTRAINT nas tabelas de música. Zero DROP e zero ALTER TABLE em tabela de vídeo ou User.
- `prisma validate` fica para a bateria do maestro, conforme solicitado. Nenhum migrate foi aplicado e nenhuma dependência foi instalada.

## Fora desta fase e limites

- Login, sessões, senha, middleware, waitlist e cadastro do pmusic: substituídos pelo next-auth do Pflix.
- Plan, Billing*, users/admin, billing e integrações de cobrança do pmusic: o Pflix já possui usuários, cobrança e Subscription.
- R2, iDrive, storage antigo, worker e proxy /api/audio: substituídos pelo Wasabi existente com prefixo music/.
- id3-parser.ts: usado apenas na página admin/upload do pmusic, com music-metadata-browser. O servidor recebe metadados JSON por tracks/from-id3; não precisa de pacote novo.
- audio-normalizer.ts, offline-manager.ts, componentes, player e páginas: recursos do navegador, fora do backend desta fase.
- Catálogo estático/demonstração de catalog.ts: somente consultas reais Prisma foram portadas.
- metrics/play: contagem centralizada em history para evitar duplicação. Proxy aberto e reprodução de previews externos ficaram de fora para manter o acesso pelo stream protegido.
- Migração dos dados e cópia dos áudios antigos: etapa posterior definida em FUSAO-PMUSIC.md. Arquivos antigos precisam ser copiados e receber chaves music/.
- Banco, credenciais Wasabi e serviços externos não foram exercitados ao vivo. Os testes usam mocks nas fronteiras de sessão, assinatura, banco e storage.
