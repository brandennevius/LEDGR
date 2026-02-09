-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'INTERNAL_TRANSFER', 'REGULAR');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "transactionType" "TransactionType" NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "Transaction" ADD COLUMN "transferPeerId" UUID;
