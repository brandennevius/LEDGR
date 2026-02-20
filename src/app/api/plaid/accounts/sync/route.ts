import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = checkRateLimit({
    key: `plaid:accounts-sync:${user.id}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { itemId?: string };

  const items = await prisma.plaidItem.findMany({
    where: {
      userId: user.id,
      ...(body?.itemId ? { itemId: body.itemId } : { status: "active" }),
    },
  });

  if (items.length === 0) {
    return NextResponse.json(
      { error: "No linked item found." },
      { status: 404 }
    );
  }

  let accountsSynced = 0;

  for (const item of items) {
    const accountsResponse = await plaidClient.accountsGet({
      access_token: item.accessToken,
    });
    const institutionName = accountsResponse.data.item?.institution_name ?? null;

    if (
      item.status !== "active" ||
      (institutionName && institutionName !== item.institutionName)
    ) {
      await prisma.plaidItem.update({
        where: { id: item.id },
        data: {
          institutionName,
          status: "active",
        },
      });
    }

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
          plaidItemId: item.id,
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
          plaidItemId: item.id,
        },
      });
      accountsSynced += 1;
    }
  }

  return NextResponse.json({ status: "synced", accounts: accountsSynced });
}
