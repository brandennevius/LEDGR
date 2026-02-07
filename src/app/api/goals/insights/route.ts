import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { getOpenAI } from "@/lib/openai";
import { buildClientSnapshot } from "@/utils/trends";
import { computeCashOnHand } from "@/lib/goals";

const debtPattern = /loan|debt|credit|card payment|payment|mortgage|student/i;
const incomePattern = /income|payroll|salary|wages|benefit|deposit|refund/i;
const transferPattern = /transfer|payment|p2p|venmo|cash app|zelle/i;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    feasibility: {
      type: "string",
      enum: ["feasible", "at_risk", "not_feasible"],
    },
    required_payment: {
      type: "object",
      additionalProperties: false,
      properties: {
        monthly: { type: "number" },
        months: { type: "number" },
        by_date: { type: "string" },
      },
      required: ["monthly", "months", "by_date"],
    },
    baseline_payoff: {
      type: "object",
      additionalProperties: false,
      properties: {
        months: { type: ["number", "null"] },
        note: { type: "string" },
      },
      required: ["months", "note"],
    },
    monthly_gap: { type: "number" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          current: { type: "number" },
          target: { type: "number" },
          savings: { type: "number" },
          note: { type: "string" },
        },
        required: ["category", "current", "target", "savings", "note"],
      },
    },
    actions: {
      type: "array",
      items: { type: "string" },
    },
    data_gaps: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "summary",
    "feasibility",
    "required_payment",
    "baseline_payoff",
    "monthly_gap",
    "recommendations",
    "actions",
    "data_gaps",
  ],
};

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const stdDev = (values: number[]) => {
  if (!values.length) return 0;
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance =
    values.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
};

const normalizeCategory = (value?: string | null) =>
  value?.trim().toUpperCase() ?? "";

const calculateMonthlyPayment = ({
  balance,
  annualRate,
  termMonths,
}: {
  balance: number;
  annualRate: number;
  termMonths: number;
}) => {
  if (balance <= 0 || termMonths <= 0) return null;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate <= 0) {
    return balance / termMonths;
  }
  const denominator = 1 - Math.pow(1 + monthlyRate, -termMonths);
  if (denominator <= 0) return null;
  return (balance * monthlyRate) / denominator;
};

const estimateMonthsWithInterest = ({
  balance,
  monthlyPayment,
  annualRate,
}: {
  balance: number;
  monthlyPayment: number;
  annualRate: number;
}) => {
  if (balance <= 0 || monthlyPayment <= 0) return null;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate <= 0) {
    return Math.ceil(balance / monthlyPayment);
  }
  if (monthlyPayment <= balance * monthlyRate) {
    return null;
  }
  const months =
    Math.log(monthlyPayment / (monthlyPayment - balance * monthlyRate)) /
    Math.log(1 + monthlyRate);
  return Math.ceil(months);
};

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatCurrencyDetailed = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

const formatInsight = (payload: {
  summary: string;
  feasibility: "feasible" | "at_risk" | "not_feasible";
  required_payment: { monthly: number; months: number; by_date: string };
  baseline_payoff: { months: number | null; note: string };
  monthly_gap: number;
  recommendations: Array<{
    category: string;
    current: number;
    target: number;
    savings: number;
    note: string;
  }>;
  actions: string[];
  data_gaps: string[];
}) => {
  const feasibilityLabel =
    payload.feasibility === "feasible"
      ? "Feasible"
      : payload.feasibility === "at_risk"
      ? "At risk"
      : "Not feasible";
  const lines: string[] = [];
  lines.push(`Debt payoff plan · ${feasibilityLabel}`);
  lines.push(payload.summary.trim());

  const requiredMonths = payload.required_payment.months ?? 0;
  const requiredMonthly = payload.required_payment.monthly ?? 0;
  if (requiredMonths > 0 && requiredMonthly > 0) {
    lines.push(
      `Required: ${formatCurrencyDetailed(requiredMonthly)}/mo for ${
        requiredMonths
      } months (target ${payload.required_payment.by_date}).`
    );
  } else {
    lines.push("Required: set a future target date to calculate monthly payment.");
  }

  if (payload.baseline_payoff.months) {
    lines.push(
      `Baseline at minimums: ~${payload.baseline_payoff.months} months.`
    );
  }

  lines.push(
    `Monthly gap: ${
      payload.monthly_gap >= 0 ? "Surplus" : "Shortfall"
    } ${formatCurrencyDetailed(Math.abs(payload.monthly_gap))}.`
  );

  const recs = payload.recommendations.slice(0, 2);
  if (recs.length) {
    lines.push(
      `Top cuts: ${recs
        .map(
          (rec) =>
            `${rec.category} save ${formatCurrencyDetailed(rec.savings)}`
        )
        .join(" · ")}.`
    );
  }
  const steps = payload.actions.slice(0, 2);
  if (steps.length) {
    lines.push(`Next steps: ${steps.join(" / ")}.`);
  }
  const gaps = payload.data_gaps.slice(0, 2);
  if (gaps.length) {
    lines.push(`Missing: ${gaps.join(" / ")}.`);
  }
  return lines.join("\n");
};

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json(
      { error: "Missing OpenAI API key." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const goalId = String(body?.goalId ?? "");
  if (!goalId) {
    return NextResponse.json({ error: "Missing goal id." }, { status: 400 });
  }

  const [goal, accounts, transactions, categorySettings] = await Promise.all([
    prisma.goal.findFirst({
      where: { id: goalId, userId: user.id },
      include: { account: true },
    }),
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({ where: { userId: user.id } }),
    prisma.category.findMany({ where: { userId: user.id } }),
  ]);

  if (!goal) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }

  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 2; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(formatMonthKey(date));
  }
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  const essentialSet = new Set(
    categorySettings.filter((row) => row.essential).map((row) => row.name)
  );
  const budgets = new Map(
    categorySettings.map((row) => [row.name, row.monthlyBudget ?? null])
  );

  const recentTx = transactions.filter((tx) => tx.date >= periodStart);
  const monthTotals = new Map<string, { income: number; expense: number }>();
  const categoryTotals = new Map<string, number>();
  const merchantTotals = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  let essentialSpendTotal = 0;
  let flexibleSpendTotal = 0;

  recentTx.forEach((tx) => {
    const name = (tx.merchantName ?? tx.name ?? "").toLowerCase();
    const categoryLabel = (tx.category ?? "").toLowerCase();
    const isTransfer =
      transferPattern.test(name) || transferPattern.test(categoryLabel);
    const isIncome =
      tx.amount < 0 || incomePattern.test(name) || incomePattern.test(categoryLabel);

    const key = formatMonthKey(tx.date);
    if (!monthTotals.has(key)) {
      monthTotals.set(key, { income: 0, expense: 0 });
    }
    const month = monthTotals.get(key);
    if (!month) return;

    if (isIncome) {
      month.income += Math.abs(tx.amount);
    } else if (tx.amount > 0 && !isTransfer) {
      month.expense += tx.amount;
      const category = tx.category ?? "Uncategorized";
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + tx.amount);
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      if (essentialSet.has(category)) {
        essentialSpendTotal += tx.amount;
      } else {
        flexibleSpendTotal += tx.amount;
      }
      const merchant = tx.merchantName ?? tx.name;
      merchantTotals.set(merchant, (merchantTotals.get(merchant) ?? 0) + tx.amount);
    }
  });

  const monthsCount = monthKeys.length;
  const incomeTotal = monthKeys.reduce(
    (acc, key) => acc + (monthTotals.get(key)?.income ?? 0),
    0
  );
  const expenseTotal = monthKeys.reduce(
    (acc, key) => acc + (monthTotals.get(key)?.expense ?? 0),
    0
  );

  const monthlyIncome = incomeTotal / monthsCount;
  const monthlyExpenses = expenseTotal / monthsCount;
  const essentialSpend = essentialSpendTotal / monthsCount;
  const flexibleSpend = flexibleSpendTotal / monthsCount;
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const essentialsLeft = monthlyIncome - essentialSpend;

  const categoryTable = Array.from(categoryTotals.entries())
    .map(([name, total]) => ({
      category: name,
      monthlyAvg: total / monthsCount,
      essential: essentialSet.has(name),
      budget: budgets.get(name) ?? null,
    }))
    .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
    .slice(0, 12);

  const topMerchants = Array.from(merchantTotals.entries())
    .map(([merchant, total]) => ({ merchant, monthlyAvg: total / monthsCount }))
    .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
    .slice(0, 5);

  const frequencyCategories = Array.from(categoryCounts.entries())
    .map(([categoryName, count]) => ({ category: categoryName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const dayStart = new Date(now);
  dayStart.setDate(now.getDate() - 29);
  dayStart.setHours(0, 0, 0, 0);
  const dayBuckets = new Map<string, number[]>();
  recentTx.forEach((tx) => {
    if (tx.amount <= 0) return;
    if (tx.date < dayStart) return;
    const dayIndex = Math.floor(
      (tx.date.getTime() - dayStart.getTime()) / 86400000
    );
    const category = tx.category ?? "Uncategorized";
    if (!dayBuckets.has(category)) {
      dayBuckets.set(category, Array.from({ length: 30 }, () => 0));
    }
    const bucket = dayBuckets.get(category);
    if (!bucket) return;
    if (dayIndex >= 0 && dayIndex < bucket.length) {
      bucket[dayIndex] += tx.amount;
    }
  });
  const volatilityCategories = Array.from(dayBuckets.entries())
    .map(([category, values]) => ({
      category,
      volatility: stdDev(values),
    }))
    .sort((a, b) => b.volatility - a.volatility)
    .slice(0, 3);

  const cashOnHand = computeCashOnHand(accounts);
  const snapshot = buildClientSnapshot({
    asOf: now,
    transactions: transactions.map((tx) => ({
      amount: tx.amount,
      date: tx.date,
      category: tx.category,
    })),
    cashOnHand,
    spendIsPositive: true,
  });

  const debtBalance =
    Math.abs(goal.account?.currentBalance ?? goal.account?.availableBalance ?? 0) ||
    goal.target;

  const inferredDebtPayments = recentTx
    .filter((tx) => {
      if (tx.amount <= 0) return false;
      if (goal.accountId) {
        return tx.accountId === goal.accountId;
      }
      const category = tx.category?.toLowerCase() ?? "";
      const name = (tx.merchantName ?? tx.name).toLowerCase();
      return debtPattern.test(category) || debtPattern.test(name);
    })
    .reduce((acc, tx) => acc + tx.amount, 0);

  const impliedMinPayment =
    goal.interestRate && goal.termMonths
      ? calculateMonthlyPayment({
          balance: debtBalance,
          annualRate: goal.interestRate,
          termMonths: goal.termMonths,
        })
      : null;
  const minPayment =
    goal.minPayment && goal.minPayment > 0
      ? goal.minPayment
      : impliedMinPayment && impliedMinPayment > 0
      ? impliedMinPayment
      : inferredDebtPayments / monthsCount;

  const minPaymentSource = goal.minPayment
    ? "user input"
    : impliedMinPayment
    ? "computed from APR + term"
    : "estimated";

  const monthsToGoal =
    goal.endDate && goal.endDate > now
      ? Math.max(
          1,
          Math.round(
            (goal.endDate.getTime() - now.getTime()) / 2592000000
          )
        )
      : null;
  const requiredMonthlyPayment =
    monthsToGoal && debtBalance > 0 ? debtBalance / monthsToGoal : null;

  const baselineMonths =
    goal.interestRate && minPayment
      ? estimateMonthsWithInterest({
          balance: debtBalance,
          monthlyPayment: minPayment,
          annualRate: goal.interestRate,
        })
      : minPayment
      ? Math.ceil(debtBalance / minPayment)
      : null;

  const dataGaps: string[] = [];
  if (monthlyIncome <= 0) {
    dataGaps.push(
      "No income transactions detected in the last 3 months. Link an income account or categorize payroll deposits."
    );
  }
  if (!goal.minPayment && (!minPayment || minPayment <= 0)) {
    dataGaps.push(
      "Minimum monthly payment missing. Enter it in the goal for accurate payoff math."
    );
  }
  if (!goal.endDate) {
    dataGaps.push(
      "Goal end date is missing. Add a target date to compute required payments."
    );
  }

  const incomeVariance =
    monthKeys.length > 1
      ? (() => {
          const incomes = monthKeys.map(
            (key) => monthTotals.get(key)?.income ?? 0
          );
          const mean =
            incomes.reduce((acc, value) => acc + value, 0) / incomes.length;
          const deviation =
            incomes.reduce((acc, value) => acc + Math.abs(value - mean), 0) /
            incomes.length;
          return mean > 0 && deviation / mean > 0.25;
        })()
      : false;

  const promptPayload = {
    client_profile: {
      goal: "Debt payoff",
      startDate: goal.startDate ? goal.startDate.toISOString().slice(0, 10) : null,
      targetEndDate: goal.endDate ? goal.endDate.toISOString().slice(0, 10) : null,
      debtBalance,
      minimumPayment: minPayment,
      minimumPaymentSource: minPaymentSource,
      interestRate: goal.interestRate ?? null,
      termMonths: goal.termMonths ?? null,
      baselinePayoffMonths: baselineMonths,
      linkedDebtAccount: goal.account?.name ?? null,
      monthlyIncome,
      essentialSpend,
      flexibleSpend,
      currentDebtPayments: inferredDebtPayments / monthsCount,
      bufferDays: snapshot.bufferDays,
      monthlySurplus,
      monthsToGoal,
      requiredMonthlyPayment,
      knownRisks: {
        irregularIncome: incomeVariance,
      },
      dataGaps,
    },
    spending_breakdown: categoryTable,
    transactions_insights: {
      topMerchants,
      volatilityCategories,
      frequencyCategories,
    },
  };

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "You are a financial coaching analyst. Your job is to help a client reach a debt payoff goal safely and realistically. You do NOT provide investment, tax, or legal advice. You only use the provided data. If data is missing or ambiguous, state what is missing and make conservative assumptions. Use monthly averages for income and expenses. Treat essentials as fixed first. Identify the minimum payment and ensure it is always covered. Keep it concise: summary 1 sentence, recommendations max 2, actions max 2, data_gaps max 2. Return JSON that matches the provided schema exactly. Always include baseline_payoff: { months, note }. Use the provided baselinePayoffMonths and interestRate when available; if it is missing or invalid, set months to null and explain why in note.",
      },
      {
        role: "user",
        content: JSON.stringify(promptPayload, null, 2),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "debt_goal_insights",
        schema: responseSchema,
        strict: true,
      },
    },
  });

  const parsed = JSON.parse(response.output_text ?? "{}");

  const endDateValid = Boolean(goal.endDate && goal.endDate > now);
  const targetDateLabel = endDateValid
    ? goal.endDate?.toISOString().slice(0, 10)
    : "n/a";
  const requiredMonths = endDateValid
    ? monthsToGoal ?? 0
    : goal.termMonths ?? 0;
  const requiredMonthly = endDateValid
    ? requiredMonthlyPayment ?? 0
    : impliedMinPayment ?? 0;
  const monthlyGap =
    requiredMonthly > 0
      ? monthlySurplus - requiredMonthly
      : monthlySurplus - (minPayment ?? 0);
  const feasibilityOverride: "feasible" | "at_risk" | "not_feasible" = endDateValid
    ? monthlyGap >= 0
      ? "feasible"
      : "not_feasible"
    : "at_risk";

  const spendSummary =
    monthlyIncome > 0
      ? `You spend ${formatCurrency(monthlyExpenses)}/mo. Essentials are ${formatCurrency(
          essentialSpend
        )}; lifestyle is ${formatCurrency(flexibleSpend)}. Income minus essentials is ${
          essentialsLeft >= 0
            ? `+${formatCurrency(essentialsLeft)}`
            : `-${formatCurrency(Math.abs(essentialsLeft))}`
        }, and income minus all expenses is ${
          monthlySurplus >= 0
            ? `+${formatCurrency(monthlySurplus)}`
            : `-${formatCurrency(Math.abs(monthlySurplus))}`
        }.`
      : "Income not detected, so we cannot calculate how much is available to redirect to debt.";

  const payoffSummary = endDateValid
    ? monthlyGap >= 0
      ? `You can hit the target date if you redirect about ${formatCurrency(Math.abs(monthlyGap))}/mo toward debt.`
      : `You are short about ${formatCurrency(Math.abs(monthlyGap))}/mo to hit the target date.`
    : "Target date is missing or in the past. Update it to calculate a realistic payoff plan.";

  const summaryOverride = `${spendSummary} ${payoffSummary}`;

  const essentialCategories = new Set(
    categoryTable
      .filter((item) => item.essential)
      .map((item) => normalizeCategory(item.category))
  );
  const excludedCategories = new Set([
    "UNCATEGORIZED",
    "TRANSFER",
    "TRANSFERS",
    "TRANSFER_OUT",
    "TRANSFER_IN",
    "PAYMENT",
    "FLEXIBLE SPENDING",
  ]);

  const filteredRecs = Array.isArray(parsed.recommendations)
    ? parsed.recommendations.filter(
        (rec: { category?: string; savings?: number }) => {
          const normalized = normalizeCategory(rec?.category);
          return (
            normalized &&
            !essentialCategories.has(normalized) &&
            !excludedCategories.has(normalized) &&
            (rec.savings ?? 0) > 0
          );
        }
      )
    : [];

  const fallbackRecs = categoryTable
    .filter((item) => {
      const normalized = normalizeCategory(item.category);
      return (
        !item.essential &&
        item.monthlyAvg > 0 &&
        normalized &&
        !excludedCategories.has(normalized)
      );
    })
    .slice(0, 2)
    .map((item) => {
      const target = item.monthlyAvg * 0.7;
      return {
        category: item.category,
        current: item.monthlyAvg,
        target,
        savings: item.monthlyAvg - target,
        note: "Reduce by ~30% for the next cycle.",
      };
    });

  const mergedDataGaps = Array.isArray(parsed.data_gaps) ? parsed.data_gaps : [];
  if (!goal.endDate || !endDateValid) {
    mergedDataGaps.unshift("Target date is missing or in the past.");
  }
  if (
    !goal.minPayment &&
    (!minPayment || minPayment <= 0) &&
    !impliedMinPayment
  ) {
    mergedDataGaps.unshift("Minimum monthly payment missing.");
  }

  parsed.summary = summaryOverride;
  parsed.feasibility = feasibilityOverride;
  parsed.required_payment = {
    monthly: requiredMonthly,
    months: requiredMonths,
    by_date: targetDateLabel ?? "n/a",
  };
  parsed.monthly_gap = monthlyGap;
  parsed.recommendations = filteredRecs.length ? filteredRecs.slice(0, 2) : fallbackRecs;
  const defaultActions: string[] = [];
  if (!goal.endDate || !endDateValid) {
    defaultActions.push("Set a future target payoff date.");
  }
  if (
    !goal.minPayment &&
    (!minPayment || minPayment <= 0) &&
    !impliedMinPayment
  ) {
    defaultActions.push("Add your minimum monthly payment.");
  }
  parsed.actions =
    defaultActions.length > 0
      ? defaultActions.slice(0, 2)
      : Array.isArray(parsed.actions)
      ? parsed.actions.slice(0, 2)
      : [];
  parsed.data_gaps = mergedDataGaps.slice(0, 2);

  if (!parsed.baseline_payoff) {
    parsed.baseline_payoff = {
      months: baselineMonths ?? null,
      note:
        baselineMonths !== null
          ? "Estimated from current minimum payment."
          : "Missing minimum payment or interest rate.",
    };
  }
  const formatted = formatInsight(parsed);

  return NextResponse.json({ insight: formatted });
}
