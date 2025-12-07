-- Aprovar todos os usuários existentes que já têm assinatura ativa
UPDATE "User" 
SET "approvalStatus" = 'APPROVED', "approvedAt" = NOW()
WHERE "approvalStatus" = 'PENDING' 
  AND "role" = 'USER' 
  AND EXISTS (
    SELECT 1 FROM "Subscription" 
    WHERE "Subscription"."userId" = "User"."id" 
    AND "Subscription"."status" = 'ACTIVE'
  );

-- Aprovar também admins (eles não precisam de aprovação)
UPDATE "User" 
SET "approvalStatus" = 'APPROVED'
WHERE "role" = 'ADMIN';
