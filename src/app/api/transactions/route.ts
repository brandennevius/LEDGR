import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { resolveCategoryColor } from "@/lib/categoryColors";
import { isIncomeTransaction } from "@/lib/transactionRules";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const category = searchParams.get("category");
  const needsReview = searchParams.get("needsReview") === "true";

  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const since = new Date();
  since.setDate(since.getDate() - Math.max(days, 1));

  const categoryFilter =
    category === "Uncategorized"
      ? { category: null }
      : category
      ? { category }
      : {};

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: client.id,
      date: { gte: since },
      ...categoryFilter,
      ...(needsReview
        ? {
            OR: [
              { categoryNeedsReview: true },
              {
                transactionType: "REGULAR",
                categorySource: "PLAID",
              },
            ],
          }
        : {}),
    },
    orderBy: { date: "desc" },
    take: 200,
    include: { splits: true },
  });
  const settings = await prisma.category.findMany({
    where: { userId: client.id },
    select: { name: true, color: true },
  });

  const settingsMap = new Map(
    settings.map((setting) => [setting.name.toLowerCase(), setting.color])
  );
  const resolveTxColor = (categoryName: string) =>
    resolveCategoryColor(
      categoryName,
      settingsMap.get(categoryName.toLowerCase()) ?? null
    );
  const displayCategory = (tx: {
    category?: string | null;
    transactionType?: string | null;
  }) => {
    if (tx.transactionType === "INTERNAL_TRANSFER") return "Internal transfer";
    if (tx.transactionType === "INCOME") return "Income";
    return tx.category ?? "Uncategorized";
  };

  const data = transactions.flatMap((tx) => {
    const label = tx.merchantName ?? tx.name;
    const date = tx.date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
    if (tx.splits.length === 0) {
      return [
        {
          id: tx.id,
          baseId: tx.id,
          name: label,
          category: displayCategory(tx),
          categoryColor: resolveTxColor(displayCategory(tx)),
          amount: Math.abs(tx.amount),
          isIncome: isIncomeTransaction({
            amount: tx.amount,
            category: tx.category,
            name: tx.name,
            merchantName: tx.merchantName,
            transactionType: tx.transactionType,
          }),
          transactionType: tx.transactionType,
          needsReview: tx.categoryNeedsReview,
          source: tx.categorySource,
          hasSplits: false,
          date,
        },
      ];
    }

    const sign = tx.amount < 0 ? -1 : 1;
    const splitRows = tx.splits.map((split) => ({
      id: `split-${split.id}`,
      baseId: tx.id,
      name: `${label} (Split)`,
      category: split.category,
      categoryColor: resolveTxColor(split.category),
      amount: Math.abs(split.amount),
      isIncome: isIncomeTransaction({
        amount: sign < 0 ? -Math.abs(split.amount) : Math.abs(split.amount),
        category: split.category,
        name: tx.name,
        merchantName: tx.merchantName,
        transactionType: tx.transactionType,
      }),
      transactionType: tx.transactionType,
      needsReview: false,
      source: "USER",
      hasSplits: true,
      date,
    }));

    const splitTotal = tx.splits.reduce((acc, split) => acc + split.amount, 0);
    const remaining = Math.max(0, Math.abs(tx.amount) - splitTotal);
    const remainderRow =
      remaining > 0.01
        ? [
            {
              id: `${tx.id}-remainder`,
              baseId: tx.id,
              name: `${label} (Remainder)`,
              category: displayCategory(tx),
              categoryColor: resolveTxColor(displayCategory(tx)),
              amount: remaining,
              isIncome: isIncomeTransaction({
                amount: sign < 0 ? -Math.abs(remaining) : Math.abs(remaining),
                category: tx.category,
                name: tx.name,
                merchantName: tx.merchantName,
                transactionType: tx.transactionType,
              }),
              transactionType: tx.transactionType,
              needsReview: tx.categoryNeedsReview,
              source: tx.categorySource,
              hasSplits: true,
              date,
            },
          ]
        : [];

    return [...splitRows, ...remainderRow];
  });

  return NextResponse.json({ transactions: data });
}
