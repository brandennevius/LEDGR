import { prisma } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    updates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          category: { type: "string" },
        },
        required: ["id", "category"],
      },
    },
  },
  required: ["updates"],
};

export const categorizeTransactions = async ({
  userId,
  limit = 60,
}: {
  userId: string;
  limit?: number;
}) => {
  const openai = getOpenAI();
  if (!openai) {
    return { updated: 0, reason: "missing_api_key" };
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      OR: [{ category: null }, { categoryNeedsReview: true }],
    },
    orderBy: { date: "desc" },
    take: limit,
  });

  if (transactions.length === 0) {
    return { updated: 0, reason: "no_transactions" };
  }

  const payload = transactions.map((tx) => ({
    id: tx.id,
    name: tx.merchantName ?? tx.name,
    amount: tx.amount,
    date: tx.date.toISOString().slice(0, 10),
  }));

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "You are a financial coach categorizer. Assign a single high-level category (e.g., Dining, Groceries, Transport, Subscriptions, Utilities, Shopping, Income, Housing, Health, Entertainment). Return JSON matching the schema. Do not provide advice.",
      },
      { role: "user", content: JSON.stringify(payload) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "category_updates",
        schema,
        strict: true,
      },
    },
  });

  const parsed = JSON.parse(response.output_text ?? "{}") as {
    updates: { id: string; category: string }[];
  };

  const allowedIds = new Set(transactions.map((tx) => tx.id));
  for (const update of parsed.updates ?? []) {
    if (!allowedIds.has(update.id)) continue;
    if (!update.category?.trim()) continue;
    await prisma.transaction.updateMany({
      where: { id: update.id },
      data: {
        category: update.category.trim(),
        categoryNeedsReview: true,
        categorySource: "AI",
      },
    });
  }

  return { updated: parsed.updates?.length ?? 0 };
};
