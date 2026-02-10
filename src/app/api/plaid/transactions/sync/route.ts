import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import type { RemovedTransaction, Transaction as PlaidTransaction } from "plaid";
import { categorizeTransactions } from "@/lib/categorize";
import { getAuthedUser } from "@/lib/auth";
import {
  classifyTransactionType,
  detectInternalTransfers,
  normalizeName,
} from "@/lib/transactionRules";

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

  const accounts = await prisma.account.findMany({ where: { userId: user.id } });
  const rules = await prisma.categoryRule.findMany({
    where: { userId: user.id },
  });
  const accountMap = new Map(
    accounts.map((account) => [account.plaidAccountId, account.id])
  );

  for (const tx of [...added, ...modified]) {
    const accountId = accountMap.get(tx.account_id);
    if (!accountId) continue;
    const accountMeta = accounts.find(
      (account) => account.plaidAccountId === tx.account_id
    );
    const transactionType = classifyTransactionType({
      amount: tx.amount,
      category:
        tx.personal_finance_category?.primary ??
        tx.category?.[0] ??
        null,
      name: tx.name,
      merchantName: tx.merchant_name ?? undefined,
      accountType: accountMeta?.type ?? null,
      accountSubtype: accountMeta?.subtype ?? null,
    });

    const normalizedName = normalizeName(tx.merchant_name ?? tx.name ?? "");
    const matchedRule = rules.find((rule) =>
      rule.matchType === "EXACT"
        ? normalizedName === normalizeName(rule.matchValue)
        : normalizedName.includes(normalizeName(rule.matchValue))
    );
    const ruleCategory = matchedRule?.category ?? null;
    const ruleType = matchedRule?.transactionType ?? null;
    await prisma.transaction.upsert({
      where: { plaidTransactionId: tx.transaction_id },
      update: {
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        amount: tx.amount,
        isoCurrencyCode: tx.iso_currency_code ?? null,
        category:
          ruleCategory ??
          tx.personal_finance_category?.primary ??
          tx.category?.[0] ??
          null,
        categoryNeedsReview: false,
        categorySource: matchedRule ? "RULE" : "PLAID",
        transactionType: ruleType ?? transactionType,
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
          ruleCategory ??
          tx.personal_finance_category?.primary ??
          tx.category?.[0] ??
          null,
        categoryNeedsReview: false,
        categorySource: matchedRule ? "RULE" : "PLAID",
        transactionType: ruleType ?? transactionType,
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

  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

  const recentTransactions = await prisma.transaction.findMany({
    where: { userId: user.id, date: { gte: fortyFiveDaysAgo } },
  });

  const accountTypeMap = new Map(
    accounts.map((account) => [
      account.id,
      { type: account.type, subtype: account.subtype },
    ])
  );

  const internalMatch = detectInternalTransfers(
    recentTransactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      date: tx.date,
      accountId: tx.accountId,
      category: tx.category,
      name: tx.name,
      merchantName: tx.merchantName ?? undefined,
      transactionType: tx.transactionType ?? null,
    })),
    accountTypeMap
  );

  for (const [outflowId, inflowId] of internalMatch.outflowToPeer.entries()) {
    await prisma.transaction.updateMany({
      where: { id: outflowId, userId: user.id },
      data: { transactionType: "INTERNAL_TRANSFER", transferPeerId: inflowId },
    });
    await prisma.transaction.updateMany({
      where: { id: inflowId, userId: user.id },
      data: { transactionType: "INTERNAL_TRANSFER", transferPeerId: outflowId },
    });
  }

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
