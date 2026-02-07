import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { public_token?: string };
  if (!body?.public_token) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

  const exchange = await plaidClient.itemPublicTokenExchange({
    public_token: body.public_token,
  });

  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  if (process.env.PLAID_ENV === "sandbox") {
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.plaidItem.updateMany({
      where: { userId: user.id, status: "active" },
      data: { status: "inactive" },
    });
  }

  await prisma.plaidItem.upsert({
    where: { itemId },
    update: {
      accessToken,
      userId: user.id,
      status: "active",
    },
    create: {
      itemId,
      accessToken,
      userId: user.id,
      status: "active",
    },
  });

  const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
  const institutionName = accountsResponse.data.item?.institution_name ?? null;

  for (const account of accountsResponse.data.accounts) {
    await prisma.account.upsert({
      where: { plaidAccountId: account.account_id },
      update: {
        name: account.name,
        type: account.type,
        subtype: account.subtype ?? null,
        mask: account.mask ?? null,
        institutionName,
        currentBalance: account.balances.current ?? null,
        availableBalance: account.balances.available ?? null,
        isoCurrencyCode: account.balances.iso_currency_code ?? null,
        userId: user.id,
      },
      create: {
        userId: user.id,
        plaidAccountId: account.account_id,
        name: account.name,
        type: account.type,
        subtype: account.subtype ?? null,
        mask: account.mask ?? null,
        institutionName,
        currentBalance: account.balances.current ?? null,
        availableBalance: account.balances.available ?? null,
        isoCurrencyCode: account.balances.iso_currency_code ?? null,
      },
    });
  }

  return NextResponse.json({ status: "linked", itemId });
}
