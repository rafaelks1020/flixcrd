/*
  Warnings:

  - Made the column `plan` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "asaasCustomerId" TEXT,
ADD COLUMN     "asaasPaymentId" TEXT,
ADD COLUMN     "asaasSubscriptionId" TEXT,
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL DEFAULT 10.00,
ALTER COLUMN "plan" SET NOT NULL,
ALTER COLUMN "plan" SET DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "asaasPaymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "billingType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "invoiceUrl" TEXT,
    "pixQrCode" TEXT,
    "pixCopiaECola" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_asaasPaymentId_key" ON "Payment"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
