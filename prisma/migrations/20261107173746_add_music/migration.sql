-- Cria enum
CREATE TYPE "TrackFormat" AS ENUM ('mp3', 'flac', 'wav', 'aac', 'ogg');

-- Cria enum
CREATE TYPE "TrackStatus" AS ENUM ('READY', 'PENDING_METADATA', 'ERROR');

-- Cria tabela
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pictureUrl" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "genres" TEXT[],
    "bio" TEXT,
    "mbid" TEXT,
    "ratingScore" DOUBLE PRECISION,
    "ratingVotes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- Cria tabela
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "coverUrl" TEXT NOT NULL,
    "backdropUrl" TEXT,
    "tags" TEXT[],
    "genres" TEXT[],
    "label" TEXT,
    "description" TEXT,
    "mbid" TEXT,
    "ratingScore" DOUBLE PRECISION,
    "ratingVotes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "artistId" TEXT NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- Cria tabela
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "format" "TrackFormat" NOT NULL,
    "genres" TEXT[],
    "description" TEXT,
    "mbid" TEXT,
    "ratingScore" DOUBLE PRECISION,
    "ratingVotes" INTEGER,
    "trackNumber" INTEGER,
    "discNumber" INTEGER,
    "bitrate" INTEGER,
    "sampleRate" INTEGER,
    "status" "TrackStatus" NOT NULL DEFAULT 'READY',
    "statusNote" TEXT,
    "lyricsLrc" TEXT,
    "lyricsPlain" TEXT,
    "hasLyrics" BOOLEAN NOT NULL DEFAULT false,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "artistId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- Cria tabela
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isCollaborative" BOOLEAN NOT NULL DEFAULT false,
    "coverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- Cria tabela
CREATE TABLE "PlaylistTrack" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("id")
);

-- Cria tabela
CREATE TABLE "PlaylistCollaborator" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistCollaborator_pkey" PRIMARY KEY ("id")
);

-- Cria tabela
CREATE TABLE "MusicFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicFavorite_pkey" PRIMARY KEY ("id")
);

-- Cria tabela
CREATE TABLE "MusicPlayHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,

    CONSTRAINT "MusicPlayHistory_pkey" PRIMARY KEY ("id")
);

-- Cria índice
CREATE INDEX "Artist_name_idx" ON "Artist"("name");

-- Cria índice
CREATE INDEX "Album_artistId_idx" ON "Album"("artistId");

-- Cria índice
CREATE INDEX "Album_title_idx" ON "Album"("title");

-- Cria índice
CREATE INDEX "Track_albumId_idx" ON "Track"("albumId");

-- Cria índice
CREATE INDEX "Track_artistId_idx" ON "Track"("artistId");

-- Cria índice
CREATE INDEX "Track_title_idx" ON "Track"("title");

-- Cria índice
CREATE INDEX "Track_status_idx" ON "Track"("status");

-- Cria índice
CREATE INDEX "Track_playCount_idx" ON "Track"("playCount");

-- Cria índice
CREATE INDEX "Playlist_userId_idx" ON "Playlist"("userId");

-- Cria índice
CREATE INDEX "Playlist_isPublic_idx" ON "Playlist"("isPublic");

-- Cria índice
CREATE INDEX "PlaylistTrack_playlistId_position_idx" ON "PlaylistTrack"("playlistId", "position");

-- Cria índice
CREATE UNIQUE INDEX "PlaylistTrack_playlistId_trackId_key" ON "PlaylistTrack"("playlistId", "trackId");

-- Cria índice
CREATE INDEX "PlaylistCollaborator_playlistId_idx" ON "PlaylistCollaborator"("playlistId");

-- Cria índice
CREATE INDEX "PlaylistCollaborator_userId_idx" ON "PlaylistCollaborator"("userId");

-- Cria índice
CREATE UNIQUE INDEX "PlaylistCollaborator_playlistId_userId_key" ON "PlaylistCollaborator"("playlistId", "userId");

-- Cria índice
CREATE INDEX "MusicFavorite_userId_addedAt_idx" ON "MusicFavorite"("userId", "addedAt" DESC);

-- Cria índice
CREATE INDEX "MusicFavorite_trackId_idx" ON "MusicFavorite"("trackId");

-- Cria índice
CREATE UNIQUE INDEX "MusicFavorite_userId_trackId_key" ON "MusicFavorite"("userId", "trackId");

-- Cria índice
CREATE INDEX "MusicPlayHistory_userId_playedAt_idx" ON "MusicPlayHistory"("userId", "playedAt" DESC);

-- Cria índice
CREATE INDEX "MusicPlayHistory_trackId_idx" ON "MusicPlayHistory"("trackId");

-- Adiciona chave estrangeira
ALTER TABLE "Album" ADD CONSTRAINT "Album_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "Track" ADD CONSTRAINT "Track_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "PlaylistCollaborator" ADD CONSTRAINT "PlaylistCollaborator_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "PlaylistCollaborator" ADD CONSTRAINT "PlaylistCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "MusicFavorite" ADD CONSTRAINT "MusicFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "MusicFavorite" ADD CONSTRAINT "MusicFavorite_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "MusicPlayHistory" ADD CONSTRAINT "MusicPlayHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "MusicPlayHistory" ADD CONSTRAINT "MusicPlayHistory_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

