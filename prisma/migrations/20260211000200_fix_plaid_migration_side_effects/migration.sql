-- Restore transaction split index if removed
CREATE INDEX IF NOT EXISTS "TransactionSplit_transactionId_idx"
ON "TransactionSplit"("transactionId");

-- Restore cascading delete on CategoryRule user relation
ALTER TABLE "CategoryRule" DROP CONSTRAINT IF EXISTS "CategoryRule_userId_fkey";
ALTER TABLE "CategoryRule"
ADD CONSTRAINT "CategoryRule_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
