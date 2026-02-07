import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { hydrateGoals } from "@/lib/goals";
import { buildClientSnapshot } from "@/utils/trends";

const incomePattern = /income|payroll|salary|wages|benefit|deposit|refund/i;
const transferPattern = /transfer|payment|p2p|venmo|cash app|zelle/i;

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const normalizeCategory = (value?: string | null) =>
  value?.trim().toUpperCase() ?? "";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["on_track", "at_risk", "off_track"],
    },
    summary: { type: "string" },
  },
  required: ["status", "summary"],
};

const fallbackSummary = ({
  goalsCount,
  surplus,
  essentialSpend,
  flexibleSpend,
}: {
  goalsCount: number;
  surplus: number;
  essentialSpend: number;
  flexibleSpend: number;
}) => {
  if (goalsCount === 0) {
    return {
      status: "on_track" as const,
      summary: "Add goals to get a monthly progress summary.",
    };
  }
  if (surplus < 0) {
    return {
      status: "at_risk" as const,
      summary: `You are spending above income this month. Essentials are ${formatCurrency(
        essentialSpend
      )} and lifestyle is ${formatCurrency(
        flexibleSpend
      )}; closing the gap keeps goals on track.`,
    };
  }
  return {
    status: "on_track" as const,
    summary: `You have a ${formatCurrency(
      surplus
    )} surplus after spending this month. Keep essentials steady and focus extra cash on your top goal.`,
  };
};

export async function POST() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [goals, transactions, accounts, categorySettings] = await Promise.all([
    prisma.goal.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({ where: { userId: user.id } }),
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.category.findMany({ where: { userId: user.id } }),
  ]);

  if (!transactions.length) {
    const summary = fallbackSummary({
      goalsCount: goals.length,
      surplus: 0,
      essentialSpend: 0,
      flexibleSpend: 0,
    });
    return NextResponse.json(summary);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysElapsed = Math.max(
    1,
    Math.floor((now.getTime() - monthStart.getTime()) / 86400000) + 1
  );
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = daysElapsed / Math.max(daysInMonth, 1);

  const settingsMap = new Map(
    categorySettings.map((setting) => [normalizeCategory(setting.name), setting])
  );

  let income = 0;
  let spend = 0;
  let essentialSpend = 0;
  let flexibleSpend = 0;

  const monthTx = transactions.filter((tx) => tx.date >= monthStart);
  monthTx.forEach((tx) => {
    const category = normalizeCategory(tx.category);
    const name = (tx.merchantName ?? tx.name).toLowerCase();
    const isTransfer = transferPattern.test(category) || transferPattern.test(name);
    const isIncome =
      tx.amount < 0 || incomePattern.test(category) || incomePattern.test(name);
    const amount = Math.abs(tx.amount);
    if (isIncome) {
      income += amount;
      return;
    }
    if (isTransfer) return;
    spend += amount;
    const setting = settingsMap.get(category);
    if (setting?.essential) {
      essentialSpend += amount;
    } else {
      flexibleSpend += amount;
    }
  });

  const surplus = income - spend;

  const snapshot = buildClientSnapshot({
    asOf: now,
    transactions: monthTx.map((tx) => ({
      amount: tx.amount,
      date: tx.date,
      category: tx.category,
    })),
    cashOnHand: accounts.reduce((acc, account) => {
      const balance = account.currentBalance ?? account.availableBalance ?? 0;
      if (account.type === "credit") return acc;
      return acc + balance;
    }, 0),
    spendIsPositive: true,
  });

  const hydratedGoals = hydrateGoals({
    goals,
    transactions: monthTx,
    accounts,
    bufferDays: snapshot.bufferDays,
  }).filter((goal) => goal.status !== "COMPLETED");

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      fallbackSummary({
        goalsCount: hydratedGoals.length,
        surplus,
        essentialSpend,
        flexibleSpend,
      })
    );
  }

  const promptPayload = {
    month: now.toISOString().slice(0, 7),
    monthProgress,
    income,
    spend,
    essentialSpend,
    flexibleSpend,
    surplus,
    goals: hydratedGoals.map((goal) => ({
      name: goal.name,
      type: goal.type,
      cadence: goal.cadence,
      target: goal.target,
      current: goal.current,
      progress:
        goal.target > 0 ? Number((goal.current / goal.target).toFixed(2)) : null,
      endDate: goal.endDate ? goal.endDate.toISOString().slice(0, 10) : null,
      minPayment: goal.minPayment ?? null,
      interestRate: goal.interestRate ?? null,
      termMonths: goal.termMonths ?? null,
      accountId: goal.accountId ?? null,
    })),
  };

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a financial coaching assistant summarizing goal progress for the current month. Respond with a 1-2 sentence summary (max 280 characters) and a status (on_track, at_risk, off_track). Use the provided data only. If surplus is negative or key data is missing, choose at_risk. Keep it concise and practical.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload, null, 2),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "goal_month_summary",
          schema: responseSchema,
          strict: true,
        },
      },
    });

    const parsed = JSON.parse(response.output_text ?? "{}");
    return NextResponse.json(parsed);
  } catch (error) {
    const summary = fallbackSummary({
      goalsCount: hydratedGoals.length,
      surplus,
      essentialSpend,
      flexibleSpend,
    });
    return NextResponse.json(summary);
  }
}
