import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { syncTransactionsForPlaidItems } from "@/lib/plaidTransactionsSync";

const isAuthorized = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const token =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return token === secret;
};

const runCronSync = async (request: Request) => {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit({
    key: "plaid:cron-sync",
    limit: 1,
    windowMs: 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const items = await prisma.plaidItem.findMany({
    where: {
      status: "active",
      updatedAt: { lt: staleBefore },
    },
    orderBy: { updatedAt: "asc" },
    take: 30,
    select: {
      id: true,
      userId: true,
      accessToken: true,
      transactionsCursor: true,
    },
  });

  if (items.length === 0) {
    return NextResponse.json({ status: "noop", reason: "no-stale-items" });
  }

  const result = await syncTransactionsForPlaidItems(items);
  return NextResponse.json({
    status: "synced",
    ...result,
  });
};

export async function POST(request: Request) {
  return runCronSync(request);
}

export async function GET(request: Request) {
  return runCronSync(request);
}
