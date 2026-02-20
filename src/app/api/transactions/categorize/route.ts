import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { categorizeTransactions } from "@/lib/categorize";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST() {
  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = checkRateLimit({
    key: `transactions:categorize:${client.id}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  const result = await categorizeTransactions({ userId: client.id });
  if (result.reason === "missing_api_key") {
    return NextResponse.json(
      { error: "OPENAI_API_KEY missing" },
      { status: 400 }
    );
  }
  return NextResponse.json(result);
}
