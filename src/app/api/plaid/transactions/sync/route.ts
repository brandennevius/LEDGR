import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { syncTransactionsForPlaidItems } from "@/lib/plaidTransactionsSync";

export async function POST() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = checkRateLimit({
    key: `plaid:transactions-sync:${user.id}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  const items = await prisma.plaidItem.findMany({
    where: { userId: user.id, status: "active" },
  });

  if (items.length === 0) {
    return NextResponse.json({ error: "No linked item found." }, { status: 404 });
  }

  const result = await syncTransactionsForPlaidItems(items);

  return NextResponse.json({
    status: "synced",
    added: result.added,
    modified: result.modified,
    removed: result.removed,
  });
}
