import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { categorizeTransactions } from "@/lib/categorize";

export async function POST() {
  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
