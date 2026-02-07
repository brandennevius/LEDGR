-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('PLAID', 'AI', 'USER');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "categoryNeedsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "categorySource" "CategorySource" NOT NULL DEFAULT 'PLAID';

-- CreateTable
CREATE TABLE "CategoryGroup" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "categories" TEXT[],
    "unassignedBudget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryGroup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CategoryGroup" ADD CONSTRAINT "CategoryGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
