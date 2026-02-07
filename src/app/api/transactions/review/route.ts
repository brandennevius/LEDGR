import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; category?: string };
  if (!body?.id) {
    return NextResponse.json({ error: "Transaction id required." }, { status: 400 });
  }

  const updated = await prisma.transaction.updateMany({
    where: { id: body.id, userId: user.id },
    data: {
      ...(body.category ? { category: body.category } : {}),
      categoryNeedsReview: false,
      categorySource: "USER",
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
