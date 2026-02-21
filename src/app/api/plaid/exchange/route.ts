import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { encryptPlaidAccessToken } from "@/lib/plaidAccessToken";

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
  const limit = checkRateLimit({
    key: `plaid:exchange:${user.id}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;
  let encryptedAccessToken: string;
  try {
    encryptedAccessToken = encryptPlaidAccessToken(itemId, accessToken);
  } catch {
    return NextResponse.json(
      { error: "Server encryption configuration error." },
      { status: 500 }
    );
  }

  const existingItem = await prisma.plaidItem.findUnique({
    where: { itemId },
    select: { userId: true },
  });
  if (existingItem && existingItem.userId !== user.id) {
    return NextResponse.json(
      { error: "Plaid item is already linked to another user." },
      { status: 409 }
    );
  }

  if (process.env.PLAID_ENV === "sandbox") {
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.plaidItem.updateMany({
      where: { userId: user.id, status: "active" },
      data: { status: "inactive" },
    });
  }

  const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
  const institutionName = accountsResponse.data.item?.institution_name ?? null;

  const plaidItem = await prisma.plaidItem.upsert({
    where: { itemId },
    update: {
      accessTokenEncrypted: encryptedAccessToken,
      userId: user.id,
      status: "active",
      institutionName,
    },
    create: {
      itemId,
      accessTokenEncrypted: encryptedAccessToken,
      userId: user.id,
      status: "active",
      institutionName,
    },
  });

  for (const account of accountsResponse.data.accounts) {
    const existingAccount = await prisma.account.findUnique({
      where: { plaidAccountId: account.account_id },
      select: { userId: true },
    });
    if (existingAccount && existingAccount.userId !== user.id) {
      return NextResponse.json(
        { error: "A Plaid account is already linked to another user." },
        { status: 409 }
      );
    }
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
        plaidItemId: plaidItem.id,
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
        plaidItemId: plaidItem.id,
      },
    });
  }

  return NextResponse.json({ status: "linked", itemId });
}
