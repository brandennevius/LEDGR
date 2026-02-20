import { NextResponse } from "next/server";

import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function escapeCsv(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      account: {
        select: {
          name: true,
          institutionName: true,
        },
      },
      splits: {
        select: {
          category: true,
          amount: true,
          note: true,
        },
      },
    },
  });

  const headers = [
    "transaction_id",
    "date",
    "name",
    "merchant_name",
    "amount",
    "iso_currency_code",
    "category",
    "transaction_type",
    "needs_review",
    "account_name",
    "institution_name",
    "split_count",
    "split_total",
    "split_categories",
  ];

  const rows = transactions.map((tx) => {
    const splitTotal = tx.splits.reduce((sum, split) => sum + split.amount, 0);
    const splitCategories = tx.splits.map((split) => split.category).join(" | ");

    return [
      tx.id,
      tx.date.toISOString(),
      tx.name,
      tx.merchantName,
      tx.amount,
      tx.isoCurrencyCode,
      tx.category,
      tx.transactionType,
      tx.categoryNeedsReview,
      tx.account?.name,
      tx.account?.institutionName,
      tx.splits.length,
      splitTotal,
      splitCategories,
    ].map(escapeCsv);
  });

  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=ledgr-transactions-${date}.csv`,
      "Cache-Control": "no-store",
    },
  });
}
