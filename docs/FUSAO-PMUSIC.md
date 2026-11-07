# Fusão pmusic dentro do Pflix

Base: este repo (pflix, Next 16, React 19, next-auth, Prisma 5). O pmusic (`../pmusic`, Next 14) é só FONTE de código:
nada roda de lá. Branch de trabalho: `fusao-pmusic`.

## Decisões fixas
- **Um login só:** next-auth do Pflix (`src/lib/auth.ts`). Descartar do pmusic: `Session`, `src/lib/auth.ts`,
  `server-session.ts`, `password.ts`, `api/auth/*`, `login`, `register`, `middleware.ts`, waitlist.
- **Uma cobrança só:** `Subscription` do Pflix (Asaas + Inter). Descartar `Plan`, `Billing*`, `WaitlistEntry`,
  `api/billing/*`, `billing/*`, `plans.ts`, `asaas.ts` do pmusic. Acesso a música = mesma regra do vídeo:
  `hasActiveSubscription(userId)` de `src/lib/subscription.ts`, admin sempre passa.
- **Um storage só:** Wasabi do Pflix (`src/lib/wasabi.ts`, bucket `WASABI_BUCKET_NAME`). Música sob o prefixo
  fixo `music/` (`music/<artistId>/<albumId>/<trackId>.<ext>`, capas em `music/covers/...`). `Track.audioUrl`
  guarda a CHAVE do objeto (sem host). Descartar `r2.ts`, `wasabi.ts` do pmusic, iDrive, `worker.js`, `api/*.js`,
  `/api/audio` (proxy aberto).
- **Tocar áudio:** `GET /api/music/tracks/[id]/stream` exige sessão + assinatura ativa (ou ADMIN), confere que a
  chave começa com `music/` e não contém `..`, e responde 302 para URL presignada de 1 h. O player usa só isso.
- **Dados de música são por USUÁRIO** (não por perfil): favoritos, histórico, playlists. Simples e igual ao pmusic.
- **Nada de vídeo é removido.** Lab, SuperFlix, transcoder etc. continuam (correções de segurança vêm na fase 2).

## Schema (adicionar ao `prisma/schema.prisma`)
`Artist`, `Album`, `Track` (+ enums `TrackFormat`, `TrackStatus`), `Playlist`, `PlaylistTrack`,
`PlaylistCollaborator`, `MusicFavorite` (era `UserFavorite` no pmusic: o nome colide com o do vídeo),
`MusicPlayHistory` (era `PlayHistory`). Relações com `User` do Pflix. Migration nova gerada por
`prisma migrate diff` (sem banco).

## Rotas
- Páginas: `/music` (home), `/music/search`, `/music/artist/[id]`, `/music/album/[id]`, `/music/track/[id]`,
  `/music/library`, `/music/playlists`, `/music/playlists/new`, `/music/playlists/[id]`, `/music/playlists/[id]/edit`.
- API usuário: `/api/music/*` (catalog, search, charts, radio, recommendations, lyrics, favorites, history,
  playlists, tracks/[id]/stream).
- Admin: páginas `/admin/music/*` e API `/api/admin/music/*` (artists, albums, tracks, upload presign,
  from-id3, musicbrainz/enrich). Toda rota admin começa com `requireAdmin()`.
- Código: `src/lib/music/*`, `src/components/music/*`.

## Fases
1. Fusão (este documento).
2. Segurança e bugs (auditoria de 07/11/2026: rotas `/api` sem auth, cron e webhooks abertos, seed `admin123`,
   path traversal no HLS, APK versionado, PlaybackProgress, dinheiro em Float etc.).
3. Importar os dados do banco antigo do pmusic (Artist/Album/Track/Playlist) e copiar os áudios para `music/`.
