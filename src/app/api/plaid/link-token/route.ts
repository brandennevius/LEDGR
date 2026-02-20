import { NextResponse } from "next/server";
import { CountryCode, LinkTokenCreateRequest, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

type LinkTokenBody = {
  mode?: "create" | "update";
  itemId?: string;
};

export async function POST(request: Request) {
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    return NextResponse.json(
      { error: "Missing PLAID_CLIENT_ID or PLAID_SECRET in .env" },
      { status: 400 }
    );
  }

  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = checkRateLimit({
    key: `plaid:link-token:${user.id}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = (await request.json().catch(() => ({}))) as LinkTokenBody;
  const mode = body?.mode ?? "create";

  const linkRequest: LinkTokenCreateRequest = {
    user: {
      client_user_id: user.id,
    },
    client_name: "LEDGR",
    country_codes: [CountryCode.Us],
    language: "en",
  };

  if (process.env.PLAID_REDIRECT_URI) {
    linkRequest.redirect_uri = process.env.PLAID_REDIRECT_URI;
  }

  if (process.env.PLAID_WEBHOOK_URL) {
    linkRequest.webhook = process.env.PLAID_WEBHOOK_URL;
  }

  if (mode === "update") {
    if (!body?.itemId) {
      return NextResponse.json(
        { error: "itemId required for update mode" },
        { status: 400 }
      );
    }
    const item = await prisma.plaidItem.findFirst({
      where: { userId: user.id, itemId: body.itemId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    linkRequest.access_token = item.accessToken;
    linkRequest.update = { account_selection_enabled: true };
  } else {
    linkRequest.products = [Products.Transactions];
  }

  try {
    const response = await plaidClient.linkTokenCreate(linkRequest);
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: unknown) {
    const plaidError =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: unknown }).response === "object"
        ? (
            (error as { response?: { data?: unknown } }).response?.data ?? {
              message: "Unknown Plaid error",
            }
          )
        : { message: "Unknown Plaid error" };
    return NextResponse.json(
      {
        error: "Plaid link-token failed",
        plaid: plaidError,
      },
      { status: 500 }
    );
  }
}
