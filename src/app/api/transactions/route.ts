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

  const data = transactions.map((tx) => ({
    id: tx.id,
    name: tx.merchantName ?? tx.name,
    category: tx.splits.length > 0 ? "Split" : tx.category ?? "Uncategorized",
    amount: Math.abs(tx.amount),
    isIncome: tx.amount < 0,
    transactionType: tx.transactionType,
    needsReview: tx.categoryNeedsReview,
    source: tx.categorySource,
    hasSplits: tx.splits.length > 0,
    date: tx.date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    }),
  }));

  return NextResponse.json({ transactions: data });
}
