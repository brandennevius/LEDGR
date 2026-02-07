import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

export async function DELETE(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    accountId?: string;
    all?: boolean;
  };

  if (body.all) {
    const txDeleted = await prisma.transaction.deleteMany({
      where: { userId: user.id },
    });
    const accountsDeleted = await prisma.account.deleteMany({
      where: { userId: user.id },
    });
    const itemsDeleted = await prisma.plaidItem.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({
      ok: true,
      deleted: {
        transactions: txDeleted.count,
        accounts: accountsDeleted.count,
        plaidItems: itemsDeleted.count,
      },
    });
  }

  if (!body.accountId) {
    return NextResponse.json(
      { error: "accountId required" },
      { status: 400 }
    );
  }

  await prisma.transaction.deleteMany({
    where: { userId: user.id, accountId: body.accountId },
  });
  await prisma.account.deleteMany({
    where: { userId: user.id, id: body.accountId },
  });

  return NextResponse.json({ ok: true });
}
