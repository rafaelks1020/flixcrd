BEGIN;

-- Filmes mantêm um único progresso; episódios usam a chave própria existente.
DROP INDEX "PlaybackProgress_profileId_titleId_key";
CREATE INDEX "PlaybackProgress_profileId_titleId_idx" ON "PlaybackProgress"("profileId", "titleId");
CREATE UNIQUE INDEX "PlaybackProgress_profileId_titleId_movie_key" ON "PlaybackProgress"("profileId", "titleId") WHERE "episodeId" IS NULL;

-- Preserva os valores existentes, arredondando para centavos.
ALTER TABLE "Payment" ALTER COLUMN "value" TYPE DECIMAL(10,2) USING round("value"::numeric, 2);
ALTER TABLE "pix_payments" ALTER COLUMN "valor" TYPE DECIMAL(10,2) USING round("valor"::numeric, 2);
ALTER TABLE "Subscription" ALTER COLUMN "price" TYPE DECIMAL(10,2) USING round("price"::numeric, 2);

-- O PIN legado será convertido para bcrypt após a primeira verificação correta.
COMMIT;
