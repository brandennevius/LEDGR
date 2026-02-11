import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

type SplitInput = {
  category: string;
  amount: number;
  note?: string | null;
};

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
    include: { splits: true },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    splits: transaction.splits.map((split) => ({
      id: split.id,
      category: split.category,
      amount: Math.abs(split.amount),
      note: split.note,
    })),
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { splits?: SplitInput[] };
  const splits = Array.isArray(body.splits)
    ? body.splits
        .map((split) => ({
          category: split.category?.trim(),
          amount: Number(split.amount ?? 0),
          note: split.note?.trim() ?? null,
        }))
        .filter((split) => split.category && split.amount > 0)
    : [];

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const total = Math.abs(transaction.amount);
  const sum = splits.reduce((acc, split) => acc + Math.abs(split.amount), 0);

  if (sum > total + 0.01) {
    return NextResponse.json(
      { error: "Split total exceeds transaction amount." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.transactionSplit.deleteMany({ where: { transactionId: id } }),
    ...(splits.length
      ? [
          prisma.transactionSplit.createMany({
            data: splits.map((split) => ({
              transactionId: id,
              category: split.category!,
              amount: Math.abs(split.amount),
              note: split.note,
            })),
          }),
        ]
      : []),
    prisma.transaction.update({
      where: { id },
      data: {
        category: splits.length ? "Split" : transaction.category,
        categorySource: splits.length ? "USER" : transaction.categorySource,
        categoryNeedsReview: false,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
