import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import type { RemovedTransaction, Transaction as PlaidTransaction } from "plaid";
import { categorizeTransactions } from "@/lib/categorize";
import { getAuthedUser } from "@/lib/auth";

export async function POST() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await prisma.plaidItem.findFirst({
    where: { userId: user.id, status: "active" },
  });

  if (!item) {
    return NextResponse.json({ error: "No linked item found." }, { status: 404 });
  }

  let cursor = item.transactionsCursor ?? null;
  let added: PlaidTransaction[] = [];
  let modified: PlaidTransaction[] = [];
  let removed: RemovedTransaction[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: item.accessToken,
      cursor: cursor ?? undefined,
      count: 100,
    });

    added = added.concat(response.data.added);
    modified = modified.concat(response.data.modified);
    removed = removed.concat(response.data.removed);
    cursor = response.data.next_cursor;
    hasMore = response.data.has_more;
  }

  const accountMap = new Map(
    (await prisma.account.findMany({ where: { userId: user.id } })).map(
      (account) => [account.plaidAccountId, account.id]
    )
  );

  for (const tx of [...added, ...modified]) {
    const accountId = accountMap.get(tx.account_id);
    if (!accountId) continue;
    await prisma.transaction.upsert({
      where: { plaidTransactionId: tx.transaction_id },
      update: {
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        amount: tx.amount,
        isoCurrencyCode: tx.iso_currency_code ?? null,
        category:
          tx.personal_finance_category?.primary ??
          tx.category?.[0] ??
          null,
        categoryNeedsReview: false,
        categorySource: "PLAID",
        date: new Date(tx.date),
        pending: tx.pending ?? false,
        accountId,
        userId: user.id,
      },
      create: {
        plaidTransactionId: tx.transaction_id,
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        amount: tx.amount,
        isoCurrencyCode: tx.iso_currency_code ?? null,
        category:
          tx.personal_finance_category?.primary ??
          tx.category?.[0] ??
          null,
        categoryNeedsReview: false,
        categorySource: "PLAID",
        date: new Date(tx.date),
        pending: tx.pending ?? false,
        accountId,
        userId: user.id,
      },
    });
  }

  for (const removedTx of removed) {
    await prisma.transaction.deleteMany({
      where: { plaidTransactionId: removedTx.transaction_id, userId: user.id },
    });
  }

  await prisma.plaidItem.update({
    where: { id: item.id },
    data: { transactionsCursor: cursor ?? undefined },
  });

  if (process.env.OPENAI_API_KEY) {
    await categorizeTransactions({ userId: user.id, limit: 50 });
  }

  return NextResponse.json({
    status: "synced",
    added: added.length,
    modified: modified.length,
    removed: removed.length,
  });
}
