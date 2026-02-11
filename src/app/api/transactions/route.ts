import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

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
      ...(needsReview ? { categoryNeedsReview: true } : {}),
    },
    orderBy: { date: "desc" },
    take: 200,
    include: { splits: true },
  });

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
          name: label,
          category: tx.category ?? "Uncategorized",
          amount: Math.abs(tx.amount),
          isIncome: tx.amount < 0,
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
      name: `${label} (Split)`,
      category: split.category,
      amount: Math.abs(split.amount),
      isIncome: sign < 0,
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
              name: `${label} (Remainder)`,
              category: tx.category ?? "Uncategorized",
              amount: remaining,
              isIncome: sign < 0,
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
