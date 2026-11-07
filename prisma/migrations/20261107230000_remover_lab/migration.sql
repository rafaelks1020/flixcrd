-- Remove o Lab (SuperFlix): colunas de provedor e a tabela de recomendacoes da IA.
-- Gerado com prisma migrate diff entre o schema anterior e o atual.
-- DropForeignKey
ALTER TABLE "AiLabRecommendation" DROP CONSTRAINT IF EXISTS "AiLabRecommendation_userId_fkey";

-- AlterTable
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "labEnabled",
DROP COLUMN IF EXISTS "streamingProvider",
DROP COLUMN IF EXISTS "superflixApiHost",
DROP COLUMN IF EXISTS "superflixApiUrl";

-- DropTable
DROP TABLE IF EXISTS "AiLabRecommendation";
