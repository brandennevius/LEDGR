-- AlterEnum
ALTER TYPE "CategorySource" ADD VALUE IF NOT EXISTS 'RULE';

-- CreateEnum
CREATE TYPE "RuleMatchType" AS ENUM ('EXACT', 'PARTIAL');

-- CreateTable
CREATE TABLE "CategoryRule" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "matchType" "RuleMatchType" NOT NULL DEFAULT 'EXACT',
  "matchValue" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "transactionType" "TransactionType" NOT NULL DEFAULT 'REGULAR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
