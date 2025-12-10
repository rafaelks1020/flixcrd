-- CreateTable
CREATE TABLE "ServiceStatusSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "healthy" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "allHealthy" BOOLEAN NOT NULL,
    "services" JSONB NOT NULL,

    CONSTRAINT "ServiceStatusSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceStatusSnapshot_createdAt_idx" ON "ServiceStatusSnapshot"("createdAt");

