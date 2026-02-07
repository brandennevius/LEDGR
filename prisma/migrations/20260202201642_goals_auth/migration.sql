-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('SAVINGS', 'DEBT', 'SPEND_LIMIT', 'INCOME_TARGET', 'BUFFER_DAYS');

-- CreateEnum
CREATE TYPE "GoalCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "cadence" "GoalCadence" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "category" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "type" "GoalType" NOT NULL DEFAULT 'SAVINGS';
