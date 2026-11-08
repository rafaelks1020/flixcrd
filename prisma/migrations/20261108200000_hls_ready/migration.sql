-- Marca o que esta 100% pronto para tocar (master.m3u8 no storage). O catalogo publico so mostra hlsReady.
ALTER TABLE "Title" ADD COLUMN "hlsReady" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Episode" ADD COLUMN "hlsReady" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Title_hlsReady_idx" ON "Title"("hlsReady");
CREATE INDEX "Episode_titleId_hlsReady_idx" ON "Episode"("titleId", "hlsReady");
