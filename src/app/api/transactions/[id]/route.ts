import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { resolveCategoryColor } from "@/lib/categoryColors";
import { isIncomeTransaction } from "@/lib/transactionRules";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [transaction, settings] = await Promise.all([
    prisma.transaction.findFirst({
      where: { id, userId: user.id },
      include: { account: true, splits: true },
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      select: { name: true, color: true },
    }),
  ]);

  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settingsMap = new Map(
    settings.map((setting) => [setting.name.toLowerCase(), setting.color])
  );
  const categoryName =
    transaction.transactionType === "INTERNAL_TRANSFER"
      ? "Internal transfer"
      : transaction.transactionType === "INCOME"
      ? "Income"
      : transaction.category ?? "Uncategorized";

  return NextResponse.json({
    id: transaction.id,
    name: transaction.merchantName ?? transaction.name,
    amount: transaction.amount,
    isIncome: isIncomeTransaction({
      amount: transaction.amount,
      category: transaction.category,
      name: transaction.name,
      merchantName: transaction.merchantName,
      transactionType: transaction.transactionType,
    }),
    category: categoryName,
    categoryColor: resolveCategoryColor(
      categoryName,
      settingsMap.get(categoryName.toLowerCase()) ?? null
    ),
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
    amount?: number;
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

  const classificationUpdates: {
    category?: string | null;
    categoryNeedsReview?: boolean;
    categorySource?: "USER";
    transactionType?: "INCOME" | "INTERNAL_TRANSFER" | "REGULAR";
  } = {};

  const nextTransactionType = body.transactionType ?? transaction.transactionType;

  if (nextTransactionType !== "REGULAR") {
    classificationUpdates.category = null;
    classificationUpdates.categoryNeedsReview = false;
    classificationUpdates.categorySource = "USER";
  } else if (body.category?.trim()) {
    classificationUpdates.category = body.category.trim();
    classificationUpdates.categoryNeedsReview = false;
    classificationUpdates.categorySource = "USER";
  }

  if (body.transactionType) {
    classificationUpdates.transactionType = body.transactionType;
  }

  let amountUpdate: number | undefined;
  if (typeof body.amount !== "undefined") {
    const parsedAmount = Number(body.amount);
    if (!Number.isFinite(parsedAmount)) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }
    amountUpdate = parsedAmount;
  }

  if (Object.keys(classificationUpdates).length === 0 && typeof amountUpdate === "undefined") {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const ruleMatchValue = body.ruleMatchValue?.trim();
  const similarMatchValue =
    ruleMatchValue || transaction.merchantName?.trim() || transaction.name;
  const similarMode =
    body.createRule && body.ruleMatchType === "PARTIAL" ? "PARTIAL" : "EXACT";

  const similarWhere =
    similarMatchValue.length > 0
      ? similarMode === "PARTIAL"
        ? {
            userId: user.id,
            OR: [
              { merchantName: { contains: similarMatchValue, mode: "insensitive" as const } },
              { name: { contains: similarMatchValue, mode: "insensitive" as const } },
            ],
          }
        : {
            userId: user.id,
            OR: [
              { merchantName: { equals: similarMatchValue, mode: "insensitive" as const } },
              { name: { equals: similarMatchValue, mode: "insensitive" as const } },
            ],
          }
      : null;

  if (body.applyToSimilar && similarWhere && Object.keys(classificationUpdates).length > 0) {
    await prisma.transaction.updateMany({ where: similarWhere, data: classificationUpdates });
  } else if (body.applyToCategory && typeof classificationUpdates.category === "string") {
    const currentCategory = transaction.category ?? "Uncategorized";
    await prisma.transaction.updateMany({
      where: {
        userId: user.id,
        category: currentCategory === "Uncategorized" ? null : currentCategory,
      },
      data: classificationUpdates,
    });
  }

  await prisma.transaction.updateMany({
    where: { id, userId: user.id },
    data: {
      ...classificationUpdates,
      ...(typeof amountUpdate !== "undefined" ? { amount: amountUpdate } : {}),
    },
  });

  if (body.createRule) {
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
          category:
            classificationUpdates.transactionType === "REGULAR"
              ? classificationUpdates.category ?? transaction.category ?? "Uncategorized"
              : "Uncategorized",
          transactionType:
            classificationUpdates.transactionType ?? transaction.transactionType ?? "REGULAR",
        },
      });

      if (
        !body.applyToSimilar &&
        similarWhere &&
        Object.keys(classificationUpdates).length > 0
      ) {
        await prisma.transaction.updateMany({
          where: similarWhere,
          data: classificationUpdates,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
