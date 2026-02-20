import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  accountKind,
  classifyTransactionType,
  detectInternalTransfers,
} from "@/lib/transactionRules";

type ChatMessage = { role: "user" | "assistant"; content: string };

type SplitLike = {
  id: string;
  amount: number;
  category: string;
  note?: string | null;
};

type TxLike = {
  id: string;
  amount: number;
  category?: string | null;
  name: string;
  merchantName?: string | null;
  transactionType?: string | null;
  accountId: string;
  date: Date;
  splits?: SplitLike[];
};

const debtPattern = /loan|debt|credit|card payment|mortgage|student/i;

const normalizeCategory = (value?: string | null) =>
  value?.trim().toUpperCase() ?? "UNCATEGORIZED";

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date) =>
  date.toLocaleString("en-US", { month: "short", year: "numeric" });

const roundMoney = (value: number) =>
  Number((Number.isFinite(value) ? value : 0).toFixed(2));

const expandTransactionsWithSplits = (transactions: TxLike[]) => {
  const expanded: Array<TxLike & { sourceTransactionId: string; splitId?: string }> = [];
  transactions.forEach((tx) => {
    if (!tx.splits || tx.splits.length === 0) {
      expanded.push({ ...tx, sourceTransactionId: tx.id });
      return;
    }
    const sign = tx.amount < 0 ? -1 : 1;
    tx.splits.forEach((split) => {
      expanded.push({
        ...tx,
        id: `split-${split.id}`,
        splitId: split.id,
        sourceTransactionId: tx.id,
        category: split.category,
        amount: Math.abs(split.amount) * sign,
      });
    });
  });
  return expanded;
};

const extractTextDelta = (event: unknown): string => {
  if (!event || typeof event !== "object") return "";
  if (
    "type" in event &&
    event.type === "response.output_text.delta" &&
    "delta" in event &&
    typeof event.delta === "string"
  ) {
    return event.delta;
  }
  return "";
};

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = checkRateLimit({
    key: `insights:chat:${user.id}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = (await request.json()) as {
    messages?: ChatMessage[];
    stream?: boolean;
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sixMonthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [transactions, categories, accounts, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id },
      include: { splits: true },
      orderBy: { date: "desc" },
    }),
    prisma.category.findMany({ where: { userId: user.id } }),
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.goal.findMany({ where: { userId: user.id } }),
  ]);

  const accountMap = new Map(
    accounts.map((account) => [
      account.id,
      { type: account.type, subtype: account.subtype, name: account.name },
    ])
  );
  const categoryMap = new Map(
    categories.map((item) => [normalizeCategory(item.name), item])
  );

  const expandedTransactions = expandTransactionsWithSplits(
    transactions as unknown as TxLike[]
  );
  const sixMonthTx = expandedTransactions.filter((tx) => tx.date >= sixMonthStart);

  const monthBuckets = new Map<
    string,
    {
      month: string;
      income: number;
      spend: number;
      essential: number;
      flexible: number;
      internalOutflow: number;
    }
  >();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = monthKey(monthDate);
    monthBuckets.set(key, {
      month: monthLabel(monthDate),
      income: 0,
      spend: 0,
      essential: 0,
      flexible: 0,
      internalOutflow: 0,
    });
  }

  const categorySpend = new Map<
    string,
    { spend: number; previousSpend: number; essential: boolean; budget: number | null }
  >();

  sixMonthTx.forEach((tx) => {
    const account = accountMap.get(tx.accountId);
    const resolvedType =
      tx.transactionType ??
      classifyTransactionType({
        amount: tx.amount,
        category: tx.category,
        name: tx.name,
        merchantName: tx.merchantName,
        accountType: account?.type ?? null,
        accountSubtype: account?.subtype ?? null,
      });
    const key = monthKey(tx.date);
    const bucket = monthBuckets.get(key);
    if (!bucket) return;

    if (resolvedType === "INCOME") {
      bucket.income += Math.abs(tx.amount);
      return;
    }

    if (resolvedType === "INTERNAL_TRANSFER") {
      if (tx.amount > 0) bucket.internalOutflow += tx.amount;
      return;
    }

    if (tx.amount <= 0) return;

    const category = normalizeCategory(tx.category);
    const settings = categoryMap.get(category);
    const essential = settings?.essential ?? false;
    const budget = settings?.monthlyBudget ?? null;

    bucket.spend += tx.amount;
    if (essential) bucket.essential += tx.amount;
    else bucket.flexible += tx.amount;

    if (key !== monthKey(monthStart) && key !== monthKey(prevMonthStart)) {
      return;
    }

    const current = categorySpend.get(category) ?? {
      spend: 0,
      previousSpend: 0,
      essential,
      budget,
    };

    if (key === monthKey(monthStart)) current.spend += tx.amount;
    if (key === monthKey(prevMonthStart)) current.previousSpend += tx.amount;
    categorySpend.set(category, current);
  });

  const monthlySeries = Array.from(monthBuckets.values()).map((bucket) => {
    const surplus = bucket.income - bucket.spend;
    return {
      month: bucket.month,
      income: roundMoney(bucket.income),
      spend: roundMoney(bucket.spend),
      essential: roundMoney(bucket.essential),
      flexible: roundMoney(bucket.flexible),
      surplus: roundMoney(surplus),
      internalTransferOutflow: roundMoney(bucket.internalOutflow),
    };
  });

  const avg = (selector: (entry: (typeof monthlySeries)[number]) => number) =>
    monthlySeries.length
      ? roundMoney(
          monthlySeries.reduce((acc, entry) => acc + selector(entry), 0) /
            monthlySeries.length
        )
      : 0;

  const monthSeries = monthlySeries[monthlySeries.length - 1] ?? {
    month: monthLabel(now),
    income: 0,
    spend: 0,
    essential: 0,
    flexible: 0,
    surplus: 0,
    internalTransferOutflow: 0,
  };

  const topCategories = Array.from(categorySpend.entries())
    .map(([name, data]) => ({
      name,
      spend: roundMoney(data.spend),
      previousSpend: roundMoney(data.previousSpend),
      delta: roundMoney(data.spend - data.previousSpend),
      essential: data.essential,
      budget: data.budget,
      budgetDelta:
        data.budget == null ? null : roundMoney(data.spend - data.budget),
    }))
    .sort((a, b) => b.spend - a.spend);

  const topFlexible = topCategories.filter((item) => !item.essential).slice(0, 6);
  const risingCategories = topCategories
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 6);
  const overBudgetCategories = topCategories
    .filter((item) => item.budget != null && item.budgetDelta != null && item.budgetDelta > 0)
    .sort((a, b) => (b.budgetDelta ?? 0) - (a.budgetDelta ?? 0))
    .slice(0, 6);

  const debtAccounts = accounts
    .map((account) => {
      const kind = accountKind(account);
      if (kind !== "debt") return null;
      const balance = Math.abs(account.currentBalance ?? account.availableBalance ?? 0);
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        institutionName: account.institutionName,
        balance: roundMoney(balance),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.balance - a.balance);

  const debtTotal = roundMoney(
    debtAccounts.reduce((acc, account) => acc + account.balance, 0)
  );

  const activeDebtGoals = goals
    .filter((goal) => goal.type === "DEBT" && goal.status !== "COMPLETED")
    .map((goal) => ({
      id: goal.id,
      name: goal.name,
      target: roundMoney(goal.target),
      current: roundMoney(goal.current),
      remaining: roundMoney(Math.max(0, goal.target - goal.current)),
      minPayment: goal.minPayment ? roundMoney(goal.minPayment) : null,
      interestRate: goal.interestRate ?? null,
      termMonths: goal.termMonths ?? null,
      endDate: goal.endDate?.toISOString().slice(0, 10) ?? null,
      accountId: goal.accountId ?? null,
    }));

  const minPaymentsFromGoals = roundMoney(
    activeDebtGoals.reduce((acc, goal) => acc + (goal.minPayment ?? 0), 0)
  );

  const transferMatch = detectInternalTransfers(
    transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      date: tx.date,
      accountId: tx.accountId,
      category: tx.category,
      name: tx.name,
      merchantName: tx.merchantName,
      transactionType: tx.transactionType,
    })),
    new Map(accounts.map((account) => [account.id, account]))
  );

  let transferToDebtMonth = 0;
  let transferToSavingsMonth = 0;
  transactions.forEach((tx) => {
    if (tx.date < monthStart || tx.amount <= 0) return;
    const destinationId = transferMatch.outflowToDestination.get(tx.id);
    if (!destinationId) return;
    const destination = accounts.find((account) => account.id === destinationId);
    if (!destination) return;
    const kind = accountKind(destination);
    if (kind === "debt") transferToDebtMonth += tx.amount;
    if (kind === "savings" || kind === "investment") transferToSavingsMonth += tx.amount;
  });

  const debtPaymentsByCategory = roundMoney(
    sixMonthTx
      .filter((tx) => tx.date >= monthStart && tx.amount > 0)
      .filter((tx) => {
        const category = normalizeCategory(tx.category).toLowerCase();
        const name = (tx.merchantName ?? tx.name ?? "").toLowerCase();
        return debtPattern.test(category) || debtPattern.test(name);
      })
      .reduce((acc, tx) => acc + tx.amount, 0)
  );

  const savingsAccountsTotal = roundMoney(
    accounts
      .filter((account) => accountKind(account) === "savings")
      .reduce(
        (acc, account) => acc + Math.max(0, account.currentBalance ?? account.availableBalance ?? 0),
        0
      )
  );
  const investmentAccountsTotal = roundMoney(
    accounts
      .filter((account) => accountKind(account) === "investment")
      .reduce(
        (acc, account) => acc + Math.max(0, account.currentBalance ?? account.availableBalance ?? 0),
        0
      )
  );
  const assetTotal = roundMoney(
    accounts
      .filter((account) => accountKind(account) !== "debt")
      .reduce(
        (acc, account) => acc + Math.max(0, account.currentBalance ?? account.availableBalance ?? 0),
        0
      )
  );

  const context = {
    generatedAt: now.toISOString(),
    period: {
      currentMonth: monthLabel(now),
      startDate: monthStart.toISOString().slice(0, 10),
    },
    coverage: {
      transactions: transactions.length,
      accounts: accounts.length,
      categories: categories.length,
      goals: goals.length,
      monthsAnalyzed: monthlySeries.length,
    },
    cashflow: {
      monthToDate: {
        income: monthSeries.income,
        spend: monthSeries.spend,
        essentialSpend: monthSeries.essential,
        flexibleSpend: monthSeries.flexible,
        surplus: monthSeries.surplus,
      },
      sixMonthAverage: {
        income: avg((entry) => entry.income),
        spend: avg((entry) => entry.spend),
        essentialSpend: avg((entry) => entry.essential),
        flexibleSpend: avg((entry) => entry.flexible),
        surplus: avg((entry) => entry.surplus),
      },
      monthlySeries,
      monthlyIncomeOverride: user.monthlyIncomeOverride ?? null,
    },
    debt: {
      hasDebtData: debtAccounts.length > 0 || activeDebtGoals.length > 0,
      totalBalance: debtTotal,
      debtAccounts: debtAccounts.slice(0, 10),
      activeDebtGoals,
      estimatedMonthlyPayments: {
        fromGoalMinimums: minPaymentsFromGoals,
        fromInternalTransfersMonthToDate: roundMoney(transferToDebtMonth),
        fromDebtTaggedTransactionsMonthToDate: debtPaymentsByCategory,
      },
    },
    savingsAndInvestments: {
      totalSavingsBalances: savingsAccountsTotal,
      totalInvestmentBalances: investmentAccountsTotal,
      totalNonDebtAssets: assetTotal,
      estimatedTransfersMonthToDate: {
        toSavingsOrInvestments: roundMoney(transferToSavingsMonth),
      },
    },
    categories: {
      topSpend: topCategories.slice(0, 10),
      topFlexible,
      risingCategories,
      overBudgetCategories,
      essentialCategoryCount: categories.filter((item) => item.essential).length,
    },
    transfers: {
      internalTransferOutflowMonthToDate: monthSeries.internalTransferOutflow,
      matchedInternalTransfers: transferMatch.internalIds.size,
    },
    safety: {
      reminder:
        "For coaching only. No tax, legal, or investment product advice.",
    },
  };

  const openai = getOpenAI();
  if (!openai) {
    const fallback =
      "AI insights are not configured yet. Add an OPENAI_API_KEY to enable chat.";
    if (body.stream) {
      return new Response(fallback, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }
    return NextResponse.json({ answer: fallback });
  }

  const systemPrompt = [
    "You are LEDGR, a financial coaching assistant.",
    "You can answer general finance education questions and personalized coaching questions using the provided clientDataContext.",
    "When the user asks whether you have access to their data, answer based on clientDataContext.coverage and sections present.",
    "For debt questions, use clientDataContext.debt first; do not claim you have no debt data when hasDebtData is true.",
    "Use concise language and practical actions. Keep lists short.",
    "Do not provide tax advice, legal advice, or investment product recommendations.",
    "Treat clientDataContext as trusted facts; do not invent metrics that are not in context.",
  ].join(" ");

  const input = [
    { role: "system" as const, content: systemPrompt },
    {
      role: "system" as const,
      content: `clientDataContext: ${JSON.stringify(context)}`,
    },
    ...(body.messages ?? []).slice(-12),
  ];

  if (body.stream) {
    const stream = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream as AsyncIterable<unknown>) {
            const delta = extractTextDelta(event);
            if (delta) {
              controller.enqueue(encoder.encode(delta));
            }
          }
        } catch {
          controller.enqueue(
            encoder.encode(
              "\n\nI hit a streaming issue. Please try your question again."
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    input,
  });

  return NextResponse.json({
    answer: response.output_text?.trim() ?? "No insights available yet.",
  });
}
