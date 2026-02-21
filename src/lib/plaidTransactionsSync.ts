import type { RemovedTransaction, Transaction as PlaidTransaction } from "plaid";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import { categorizeTransactions } from "@/lib/categorize";
import {
  classifyTransactionType,
  detectInternalTransfers,
  normalizeName,
} from "@/lib/transactionRules";

type SyncChanges = {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: RemovedTransaction[];
};

type PlaidErrorInfo = {
  code: string | null;
  message: string | null;
  statusCode: number | null;
};

const plaidErrorStatusByCode: Record<string, "attention" | "disconnected"> = {
  ITEM_LOGIN_REQUIRED: "attention",
  INVALID_ACCESS_TOKEN: "disconnected",
};

const getPlaidErrorInfo = (error: unknown): PlaidErrorInfo => {
  const maybeResponse =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object"
      ? ((error as { response?: { status?: number; data?: unknown } }).response ?? {})
      : {};

  const statusCode =
    typeof maybeResponse.status === "number" ? maybeResponse.status : null;
  const data =
    typeof maybeResponse.data === "object" && maybeResponse.data !== null
      ? (maybeResponse.data as Record<string, unknown>)
      : {};

  const code = typeof data.error_code === "string" ? data.error_code : null;
  const message =
    typeof data.error_message === "string" ? data.error_message : null;

  return { code, message, statusCode };
};

const syncOnePlaidItem = async (item: {
  id: string;
  accessToken: string;
  transactionsCursor?: string | null;
}): Promise<SyncChanges> => {
  let added: PlaidTransaction[] = [];
  let modified: PlaidTransaction[] = [];
  let removed: RemovedTransaction[] = [];

  let cursor = item.transactionsCursor ?? null;
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

  await prisma.plaidItem.update({
    where: { id: item.id },
    data: { transactionsCursor: cursor ?? undefined },
  });

  return { added, modified, removed };
};

const applyUserTransactionChanges = async (
  userId: string,
  changes: SyncChanges
) => {
  const [accounts, rules] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.categoryRule.findMany({ where: { userId } }),
  ]);

  const accountMap = new Map(
    accounts.map((account) => [account.plaidAccountId, account.id])
  );

  for (const tx of [...changes.added, ...changes.modified]) {
    const accountId = accountMap.get(tx.account_id);
    if (!accountId) continue;
    const accountMeta = accounts.find(
      (account) => account.plaidAccountId === tx.account_id
    );
    const transactionType = classifyTransactionType({
      amount: tx.amount,
      category: tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null,
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

    const existingTx = await prisma.transaction.findUnique({
      where: { plaidTransactionId: tx.transaction_id },
      select: { userId: true },
    });
    if (existingTx && existingTx.userId !== userId) {
      continue;
    }

    await prisma.transaction.upsert({
      where: { plaidTransactionId: tx.transaction_id },
      update: {
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        amount: tx.amount,
        isoCurrencyCode: tx.iso_currency_code ?? null,
        category:
          ruleCategory ?? tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null,
        categoryNeedsReview: (ruleType ?? transactionType) === "REGULAR",
        categorySource: matchedRule ? "RULE" : "PLAID",
        transactionType: ruleType ?? transactionType,
        date: new Date(tx.date),
        pending: tx.pending ?? false,
        accountId,
        userId,
      },
      create: {
        plaidTransactionId: tx.transaction_id,
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        amount: tx.amount,
        isoCurrencyCode: tx.iso_currency_code ?? null,
        category:
          ruleCategory ?? tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null,
        categoryNeedsReview: (ruleType ?? transactionType) === "REGULAR",
        categorySource: matchedRule ? "RULE" : "PLAID",
        transactionType: ruleType ?? transactionType,
        date: new Date(tx.date),
        pending: tx.pending ?? false,
        accountId,
        userId,
      },
    });
  }

  for (const removedTx of changes.removed) {
    await prisma.transaction.deleteMany({
      where: { plaidTransactionId: removedTx.transaction_id, userId },
    });
  }

  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
  const recentTransactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: fortyFiveDaysAgo } },
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
      where: { id: outflowId, userId },
      data: { transactionType: "INTERNAL_TRANSFER", transferPeerId: inflowId },
    });
    await prisma.transaction.updateMany({
      where: { id: inflowId, userId },
      data: { transactionType: "INTERNAL_TRANSFER", transferPeerId: outflowId },
    });
  }

  if (process.env.OPENAI_API_KEY) {
    await categorizeTransactions({ userId, limit: 50 });
  }
};

export const syncTransactionsForPlaidItems = async (
  items: Array<{
    id: string;
    userId: string;
    accessToken: string;
    transactionsCursor?: string | null;
  }>
) => {
  if (items.length === 0) {
    return {
      users: 0,
      items: 0,
      added: 0,
      modified: 0,
      removed: 0,
    };
  }

  const userChanges = new Map<string, SyncChanges>();
  let failedItems = 0;

  for (const item of items) {
    let changes: SyncChanges;
    try {
      changes = await syncOnePlaidItem(item);
    } catch (error: unknown) {
      const plaidError = getPlaidErrorInfo(error);
      const nextStatus = plaidError.code
        ? plaidErrorStatusByCode[plaidError.code]
        : undefined;

      if (!nextStatus) {
        throw error;
      }

      await prisma.plaidItem.updateMany({
        where: { id: item.id },
        data: { status: nextStatus },
      });
      failedItems += 1;
      continue;
    }

    const existing = userChanges.get(item.userId) ?? {
      added: [],
      modified: [],
      removed: [],
    };
    existing.added.push(...changes.added);
    existing.modified.push(...changes.modified);
    existing.removed.push(...changes.removed);
    userChanges.set(item.userId, existing);
  }

  for (const [userId, changes] of userChanges.entries()) {
    await applyUserTransactionChanges(userId, changes);
  }

  return {
    users: userChanges.size,
    items: items.length,
    added: Array.from(userChanges.values()).reduce(
      (sum, value) => sum + value.added.length,
      0
    ),
    modified: Array.from(userChanges.values()).reduce(
      (sum, value) => sum + value.modified.length,
      0
    ),
    removed: Array.from(userChanges.values()).reduce(
      (sum, value) => sum + value.removed.length,
      0
    ),
    failedItems,
  };
};
