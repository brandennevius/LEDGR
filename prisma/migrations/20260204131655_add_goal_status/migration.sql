-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE';
