import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import { checkRateLimit } from "@/lib/rateLimit";
import { syncTransactionsForPlaidItems } from "@/lib/plaidTransactionsSync";

const attentionCodes = new Set([
  "PENDING_DISCONNECT",
  "PENDING_EXPIRATION",
  "ITEM_LOGIN_REQUIRED",
  "NEW_ACCOUNTS_AVAILABLE",
]);

const disconnectedCodes = new Set([
  "ERROR",
  "USER_PERMISSION_REVOKED",
  "USER_ACCOUNT_REVOKED",
]);

const recoveredCodes = new Set(["LOGIN_REPAIRED", "ITEM_LOGIN_REPAIRED"]);
const transactionWebhookCodes = new Set([
  "SYNC_UPDATES_AVAILABLE",
  "DEFAULT_UPDATE",
  "INITIAL_UPDATE",
  "HISTORICAL_UPDATE",
  "TRANSACTIONS_REMOVED",
]);

const verifyWebhook = async (rawBody: string, jwt: string) => {
  const header = decodeProtectedHeader(jwt);
  if (header.alg !== "ES256" || !header.kid) {
    throw new Error("Invalid webhook signature header.");
  }

  const response = await plaidClient.webhookVerificationKeyGet({
    key_id: header.kid,
  });
  const key = await importJWK(response.data.key, "ES256");
  const { payload } = await jwtVerify(jwt, key, { algorithms: ["ES256"] });
  const payloadData = payload as {
    iat?: number;
    request_body_sha256?: string;
  };

  const iat = typeof payloadData.iat === "number" ? payloadData.iat : null;
  if (!iat) {
    throw new Error("Missing iat in webhook signature.");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - iat) > 300) {
    throw new Error("Webhook signature expired.");
  }

  const claimedHash =
    typeof payloadData.request_body_sha256 === "string"
      ? payloadData.request_body_sha256
      : null;
  if (!claimedHash) {
    throw new Error("Missing request body hash.");
  }

  const computedHash = createHash("sha256").update(rawBody).digest("hex");
  const claimedBuffer = Buffer.from(claimedHash, "hex");
  const computedBuffer = Buffer.from(computedHash, "hex");

  if (
    claimedBuffer.length !== computedBuffer.length ||
    !timingSafeEqual(claimedBuffer, computedBuffer)
  ) {
    throw new Error("Webhook hash mismatch.");
  }
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const payload = (() => {
    if (!rawBody) return null;
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })() as
    | {
        webhook_type?: string;
        webhook_code?: string;
        item_id?: string;
      }
    | null;

  const signedJwt = request.headers.get("plaid-verification");
  const shouldVerify = process.env.PLAID_WEBHOOK_VERIFY !== "false";
  if (shouldVerify) {
    if (!signedJwt) {
      return NextResponse.json(
        { error: "Missing Plaid-Verification header." },
        { status: 400 }
      );
    }
    try {
      await verifyWebhook(rawBody, signedJwt);
    } catch {
      return NextResponse.json(
        { error: "Webhook verification failed." },
        { status: 401 }
      );
    }
  }

  if (!payload?.item_id) {
    return NextResponse.json({ ok: true });
  }

  const { webhook_type, webhook_code } = payload;
  if (!webhook_code) {
    return NextResponse.json({ ok: true });
  }

  let status: string | null = null;
  if (attentionCodes.has(webhook_code)) {
    status = "attention";
  } else if (disconnectedCodes.has(webhook_code)) {
    status = "disconnected";
  } else if (recoveredCodes.has(webhook_code)) {
    status = "active";
  }

  if (status) {
    await prisma.plaidItem.updateMany({
      where: { itemId: payload.item_id },
      data: { status },
    });
  }

  const shouldSyncTransactions =
    webhook_type === "TRANSACTIONS" &&
    transactionWebhookCodes.has(webhook_code);

  if (shouldSyncTransactions) {
    const limit = checkRateLimit({
      key: `plaid:webhook-sync:${payload.item_id}`,
      limit: 6,
      windowMs: 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json({ ok: true, throttled: true });
    }

    const plaidItems = await prisma.plaidItem.findMany({
      where: { itemId: payload.item_id, status: "active" },
      select: {
        id: true,
        userId: true,
        accessToken: true,
        transactionsCursor: true,
      },
    });
    if (plaidItems.length > 0) {
      await syncTransactionsForPlaidItems(plaidItems);
    }
  }

  return NextResponse.json({ ok: true });
}
