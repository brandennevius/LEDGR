import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { getClientOverviewData } from "@/lib/dashboardData";
import { getOpenAI } from "@/lib/openai";
import { checkRateLimit } from "@/lib/rateLimit";

const summarySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "highlights", "actions"],
};

export async function POST() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = checkRateLimit({
    key: `insights:summary:${user.id}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { snapshot, goals, clientName, budgetSnapshot, budgetRecommendations } =
    await getClientOverviewData(user);

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json({
      summary: "Automated summary unavailable. Showing rule-based insights.",
      highlights: snapshot.aiHighlights,
      actions: snapshot.aiActions,
      source: "rule",
    });
  }

  const input = {
    clientName,
    goals,
    snapshot: {
      totalChangePct: snapshot.totalChangePct,
      volatilityLabel: snapshot.volatilityLabel,
      bufferDays: snapshot.bufferDays,
      topDrift: snapshot.topDrift,
      lateNightDining: snapshot.lateNightDining,
      subscriptionChangePct: snapshot.subscriptionChangePct,
    },
    budgets: budgetSnapshot,
    recommendations: budgetRecommendations ?? [],
  };

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a financial coaching analyst. Use goals, spending trends, and budget/essential context to craft a concise, supportive summary and actionable next steps. Avoid tax, legal, or investment advice. Return JSON that matches the provided schema.",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "coaching_summary",
          schema: summarySchema,
          strict: true,
        },
      },
    });

    const parsed = JSON.parse(response.output_text ?? "{}");

    return NextResponse.json({
      ...parsed,
      source: "openai",
    });
  } catch {
    return NextResponse.json({
      summary: "AI summary failed. Showing rule-based insights.",
      highlights: snapshot.aiHighlights,
      actions: snapshot.aiActions,
      source: "rule",
    });
  }
}
