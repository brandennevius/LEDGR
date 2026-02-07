-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "accountId" UUID;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
