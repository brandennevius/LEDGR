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
    include: { account: true },
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
  };

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

  const updated = await prisma.transaction.updateMany({
    where: { id, userId: user.id },
    data: updates,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
