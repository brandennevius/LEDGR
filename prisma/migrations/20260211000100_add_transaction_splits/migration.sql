-- CreateTable
CREATE TABLE "TransactionSplit" (
  "id" UUID NOT NULL,
  "transactionId" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TransactionSplit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionSplit_transactionId_idx" ON "TransactionSplit"("transactionId");

-- AddForeignKey
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
