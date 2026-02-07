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
  const body = (await request.json()) as { category?: string };
  if (!body?.category?.trim()) {
    return NextResponse.json(
      { error: "Category required." },
      { status: 400 }
    );
  }

  const updated = await prisma.transaction.updateMany({
    where: { id, userId: user.id },
    data: {
      category: body.category.trim(),
      categoryNeedsReview: false,
      categorySource: "USER",
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
