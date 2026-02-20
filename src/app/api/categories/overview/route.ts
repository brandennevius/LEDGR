import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { resolveCategoryColor } from "@/lib/categoryColors";

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const normalizeCategory = (value?: string | null) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "Uncategorized";
  if (trimmed.toLowerCase() === "split") return "Uncategorized";
  return trimmed;
};
const isTransferCategoryName = (value?: string | null) => {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return false;
  return /(transfer[_\s-]*out|transfer[_\s-]*in|internal[_\s-]*transfer)/i.test(
    key
  );
};

export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [settings, groups, transactions] = await Promise.all([
    prisma.category.findMany({ where: { userId: user.id } }),
    prisma.categoryGroup.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({
      where: { userId: user.id, account: { syncEnabled: true } },
      orderBy: { date: "desc" },
      include: { splits: true },
    }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = formatMonthKey(prevMonthStart);
  const currentMonthKey = formatMonthKey(now);
  const daysElapsed = Math.max(
    1,
    Math.floor((now.getTime() - monthStart.getTime()) / 86400000) + 1
  );
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const currentSpend = new Map<string, number>();
  const prevSpend = new Map<string, number>();

  type SpendEntry = { category: string; amount: number; date: Date };
  const spendEntries: SpendEntry[] = [];
  transactions.forEach((tx) => {
    if (tx.transactionType !== "REGULAR") return;
    const isCredit = tx.amount < 0;
    const sign = isCredit ? -1 : 1;
    if (tx.splits.length === 0) {
      const category = normalizeCategory(tx.category);
      if (isTransferCategoryName(category)) return;
      spendEntries.push({
        category,
        amount: tx.amount,
        date: tx.date,
      });
      return;
    }

    const splitRows = tx.splits
      .map((split) => ({
        category: normalizeCategory(split.category),
        amount: sign * Math.max(0, Math.abs(split.amount)),
      }))
      .filter((row) => Math.abs(row.amount) > 0 && !isTransferCategoryName(row.category));
    const splitTotal = splitRows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
    splitRows.forEach((row) => {
      spendEntries.push({
        category: row.category,
        amount: row.amount,
        date: tx.date,
      });
    });

    const remainder = Math.max(0, Math.abs(tx.amount) - splitTotal);
    if (remainder > 0.01) {
      const category = normalizeCategory(tx.category);
      if (isTransferCategoryName(category)) return;
      spendEntries.push({
        category,
        amount: sign * remainder,
        date: tx.date,
      });
    }
  });

  spendEntries.forEach((entry) => {
    const key = formatMonthKey(entry.date);
    if (key === currentMonthKey) {
      currentSpend.set(
        entry.category,
        (currentSpend.get(entry.category) ?? 0) + entry.amount
      );
    } else if (key === prevMonthKey) {
      prevSpend.set(entry.category, (prevSpend.get(entry.category) ?? 0) + entry.amount);
    }
  });

  const settingsMap = new Map(settings.map((item) => [item.name, item]));
  const categoryNames = new Set([
    ...Array.from(currentSpend.keys()),
    ...Array.from(prevSpend.keys()),
    ...settings
      .map((item) => item.name)
      .filter((name) => !isTransferCategoryName(name)),
  ]);

  const categories = Array.from(categoryNames)
    .filter(Boolean)
    .map((name) => {
      const setting = settingsMap.get(name);
      const spend = currentSpend.get(name) ?? 0;
      const previous = prevSpend.get(name) ?? 0;
      const budget = setting?.monthlyBudget ?? null;
      const projected = spend > 0 ? (spend / daysElapsed) * daysInMonth : 0;
      const remaining = budget !== null ? budget - spend : null;
      const status: "ok" | "risk" | "over" | "neutral" =
        budget === null
          ? "neutral"
          : spend > budget
          ? "over"
          : projected > budget
          ? "risk"
          : "ok";
      return {
        name,
        color: resolveCategoryColor(name, setting?.color),
        spend,
        prevSpend: previous,
        budget,
        essential: setting?.essential ?? false,
        projected,
        remaining,
        status,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const totalSpend = categories.reduce((acc, row) => acc + row.spend, 0);
  const totalBudget = settings.reduce(
    (acc, row) => acc + (row.monthlyBudget ?? 0),
    0
  );
  const totalPrevSpend = categories.reduce((acc, row) => acc + row.prevSpend, 0);
  const projectedTotal =
    totalSpend > 0 ? (totalSpend / daysElapsed) * daysInMonth : 0;
  const changePct =
    totalPrevSpend === 0 ? 0 : ((totalSpend - totalPrevSpend) / totalPrevSpend) * 100;

  const summary = {
    mode: totalBudget > 0 ? ("budget" as const) : ("compare" as const),
    spend: totalSpend,
    budget: totalBudget,
    projected: projectedTotal,
    prevSpend: totalPrevSpend,
    changePct,
  };

  const groupsData = groups.map((group) => {
    const groupCategories = categories.filter((item) =>
      group.categories.includes(item.name)
    );
    const spend = groupCategories.reduce((acc, item) => acc + item.spend, 0);
    const budget =
      groupCategories.reduce((acc, item) => acc + (item.budget ?? 0), 0) +
      (group.unassignedBudget ?? 0);
    const projected = spend > 0 ? (spend / daysElapsed) * daysInMonth : 0;
    const status: "ok" | "risk" | "over" | "neutral" =
      budget === 0
        ? "neutral"
        : spend > budget
        ? "over"
        : projected > budget
        ? "risk"
        : "ok";
    return {
      id: group.id,
      name: group.name,
      spend,
      budget: budget > 0 ? budget : null,
      unassignedBudget: group.unassignedBudget ?? null,
      status,
      categories: groupCategories,
    };
  });

  const transactionsData = transactions.flatMap((tx) => {
    if (tx.transactionType !== "REGULAR") {
      return [];
    }
    if (tx.splits.length === 0) {
      return [
        {
          id: tx.id,
          name: tx.merchantName ?? tx.name,
          amount: tx.amount,
          category: normalizeCategory(tx.category),
          date: tx.date.toISOString(),
        },
      ];
    }

    const splitRows = tx.splits
      .map((split) => ({
        id: `${tx.id}:split:${split.id}`,
        name: tx.merchantName ?? tx.name,
        amount: (tx.amount < 0 ? -1 : 1) * Math.abs(split.amount),
        category: normalizeCategory(split.category),
        date: tx.date.toISOString(),
      }))
      .filter((row) => Math.abs(row.amount) > 0 && !isTransferCategoryName(row.category));

    const splitTotal = splitRows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
    const remainder = Math.max(0, Math.abs(tx.amount) - splitTotal);
    const remainderRow =
      remainder > 0.01
        ? [
            {
              id: `${tx.id}:remainder`,
              name: tx.merchantName ?? tx.name,
              amount: (tx.amount < 0 ? -1 : 1) * remainder,
              category: normalizeCategory(tx.category),
              date: tx.date.toISOString(),
            },
          ]
        : [];

    return [
      ...splitRows,
      ...remainderRow.filter((row) => !isTransferCategoryName(row.category)),
    ];
  });

  return NextResponse.json({
    summary,
    categories,
    groups: groupsData,
    transactions: transactionsData,
  });
}
