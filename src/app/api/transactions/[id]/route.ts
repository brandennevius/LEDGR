import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    include: { account: true, splits: true },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: transaction.id,
    name: transaction.merchantName ?? transaction.name,
    amount: transaction.amount,
    category: transaction.category ?? "Uncategorized",
    transactionType: transaction.transactionType,
    transferPeerId: transaction.transferPeerId,
    date: transaction.date.toISOString(),
    needsReview: transaction.categoryNeedsReview,
    source: transaction.categorySource,
    hasSplits: transaction.splits.length > 0,
    splits: transaction.splits.map((split) => ({
      id: split.id,
      category: split.category,
      amount: Math.abs(split.amount),
      note: split.note,
    })),
    account: {
      name: transaction.account.name,
      institutionName: transaction.account.institutionName,
      mask: transaction.account.mask,
      type: transaction.account.type,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as {
    category?: string;
    transactionType?: "INCOME" | "INTERNAL_TRANSFER" | "REGULAR";
    applyToSimilar?: boolean;
    applyToCategory?: boolean;
    createRule?: boolean;
    ruleMatchType?: "EXACT" | "PARTIAL";
    ruleMatchValue?: string;
  };

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: {
    category?: string;
    categoryNeedsReview?: boolean;
    categorySource?: "USER";
    transactionType?: "INCOME" | "INTERNAL_TRANSFER" | "REGULAR";
  } = {};

  if (body.category?.trim()) {
    updates.category = body.category.trim();
    updates.categoryNeedsReview = false;
    updates.categorySource = "USER";
  }

  if (body.transactionType) {
    updates.transactionType = body.transactionType;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  if (body.applyToSimilar && updates.category) {
    const nameMatch = transaction.merchantName?.trim()
      ? { merchantName: transaction.merchantName }
      : { name: transaction.name };
    await prisma.transaction.updateMany({
      where: {
        userId: user.id,
        ...nameMatch,
      },
      data: updates,
    });
  } else if (body.applyToCategory && updates.category) {
    const currentCategory = transaction.category ?? "Uncategorized";
    await prisma.transaction.updateMany({
      where: {
        userId: user.id,
        category: currentCategory === "Uncategorized" ? null : currentCategory,
      },
      data: updates,
    });
  } else {
    await prisma.transaction.updateMany({
      where: { id, userId: user.id },
      data: updates,
    });
  }

  if (body.createRule && updates.category) {
    const matchValue =
      body.ruleMatchValue?.trim() ||
      transaction.merchantName ||
      transaction.name;
    if (matchValue) {
      await prisma.categoryRule.create({
        data: {
          userId: user.id,
          matchType: body.ruleMatchType ?? "EXACT",
          matchValue,
          category: updates.category,
          transactionType: updates.transactionType ?? "REGULAR",
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
