-- DropForeignKey
ALTER TABLE "CategoryRule" DROP CONSTRAINT "CategoryRule_userId_fkey";

-- DropIndex
DROP INDEX "TransactionSplit_transactionId_idx";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "plaidItemId" UUID;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "PlaidItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
