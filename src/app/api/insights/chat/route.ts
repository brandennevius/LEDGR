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
type UserScopeMode =
  | "general_education_only"
  | "aggregated_financial_context"
  | "transaction_detail";

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

type Intent = {
  mode: UserScopeMode;
  asksTransactions: boolean;
  asksCategories: boolean;
  asksCashflow: boolean;
  asksNetWorth: boolean;
  asksDebt: boolean;
  asksGoals: boolean;
  needsPersonalData: boolean;
  transactionDetailMode: boolean;
  classifier: {
    source: "model" | "fallback";
    confidence: number;
    reason: string;
  };
};

const debtPattern = /loan|debt|credit|card payment|mortgage|student/i;
const MAX_MESSAGE_CHARS = 1200;
const CLASSIFIER_PROMPT =
  "Classify user scope for a personal finance assistant. Output JSON only. " +
  "Use transaction_detail only when the user explicitly asks for specific transactions, merchants, or list/detail lookups. " +
  "Use aggregated_financial_context for normal personalized coaching questions about spending, budget, savings, debt, goals, cash flow, or net worth. " +
  "Use general_education_only for purely educational questions not about their personal finances.";
const intentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scope: {
      type: "string",
      enum: [
        "general_education_only",
        "aggregated_financial_context",
        "transaction_detail",
      ],
    },
    asks_transactions: { type: "boolean" },
    asks_categories: { type: "boolean" },
    asks_cashflow: { type: "boolean" },
    asks_net_worth: { type: "boolean" },
    asks_debt: { type: "boolean" },
    asks_goals: { type: "boolean" },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
  required: [
    "scope",
    "asks_transactions",
    "asks_categories",
    "asks_cashflow",
    "asks_net_worth",
    "asks_debt",
    "asks_goals",
    "confidence",
    "reason",
  ],
} as const;
type IntentClassifierResponse = {
  scope: UserScopeMode;
  asks_transactions: boolean;
  asks_categories: boolean;
  asks_cashflow: boolean;
  asks_net_worth: boolean;
  asks_debt: boolean;
  asks_goals: boolean;
  confidence: number;
  reason: string;
};

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

const getLastUserMessage = (messages: ChatMessage[] = []) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user" && messages[i]?.content?.trim()) {
      return messages[i].content.trim();
    }
  }
  return "";
};

const clampConfidence = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(2));
};

const buildFallbackIntent = (latestUserPrompt: string, reason: string): Intent => {
  const hasPrompt = latestUserPrompt.trim().length > 0;
  const mode: UserScopeMode = hasPrompt
    ? "aggregated_financial_context"
    : "general_education_only";
  return {
    mode,
    asksTransactions: false,
    asksCategories: false,
    asksCashflow: hasPrompt,
    asksNetWorth: false,
    asksDebt: false,
    asksGoals: false,
    needsPersonalData: mode !== "general_education_only",
    transactionDetailMode: false,
    classifier: {
      source: "fallback",
      confidence: 0,
      reason,
    },
  };
};

const classifyIntent = async ({
  openai,
  messages,
  latestUserPrompt,
}: {
  openai: NonNullable<ReturnType<typeof getOpenAI>>;
  messages: ChatMessage[];
  latestUserPrompt: string;
}): Promise<Intent> => {
  if (!latestUserPrompt.trim()) {
    return buildFallbackIntent(latestUserPrompt, "No user prompt provided.");
  }

  const conversation = messages
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [
        { role: "system", content: CLASSIFIER_PROMPT },
        { role: "user", content: conversation },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "chat_intent_classifier",
          schema: intentSchema,
          strict: true,
        },
      },
    });

    const parsed = JSON.parse(
      response.output_text ?? "{}"
    ) as IntentClassifierResponse;
    const mode: UserScopeMode =
      parsed.scope === "transaction_detail" ||
      parsed.scope === "aggregated_financial_context" ||
      parsed.scope === "general_education_only"
        ? parsed.scope
        : "aggregated_financial_context";

    const lowConfidenceTransactionDetail =
      mode === "transaction_detail" && clampConfidence(parsed.confidence) < 0.6;
    const safeMode: UserScopeMode = lowConfidenceTransactionDetail
      ? "aggregated_financial_context"
      : mode;
    const transactionDetailMode = safeMode === "transaction_detail";
    const asksTransactions = parsed.asks_transactions || transactionDetailMode;

    return {
      mode: safeMode,
      asksTransactions,
      asksCategories: parsed.asks_categories,
      asksCashflow: parsed.asks_cashflow,
      asksNetWorth: parsed.asks_net_worth,
      asksDebt: parsed.asks_debt,
      asksGoals: parsed.asks_goals,
      needsPersonalData: safeMode !== "general_education_only",
      transactionDetailMode,
      classifier: {
        source: "model",
        confidence: clampConfidence(parsed.confidence),
        reason:
          typeof parsed.reason === "string" && parsed.reason.trim().length > 0
            ? parsed.reason.trim().slice(0, 240)
            : "Model classified user scope.",
      },
    };
  } catch {
    return buildFallbackIntent(
      latestUserPrompt,
      "Classifier failed, used secure aggregated fallback."
    );
  }
};

const sanitizeMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) return [];
  const sanitized = value
    .flatMap((entry): ChatMessage[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { role?: unknown; content?: unknown };
      const role =
        candidate.role === "user" || candidate.role === "assistant"
          ? candidate.role
          : null;
      const content =
        typeof candidate.content === "string"
          ? candidate.content.trim().slice(0, MAX_MESSAGE_CHARS)
          : "";
      if (!role || !content) return [];
      return [{ role, content }];
    })
    .slice(-12);

  return sanitized;
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

  const rawBody = (await request.json()) as {
    messages?: unknown;
    stream?: unknown;
  };

  const messages = sanitizeMessages(rawBody.messages);
  const streamRequested = rawBody.stream === true;
  const latestUserPrompt = getLastUserMessage(messages);
  const openai = getOpenAI();
  if (!openai) {
    const fallback =
      "AI insights are not configured yet. Add an OPENAI_API_KEY to enable chat.";
    if (streamRequested) {
      return new Response(fallback, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }
    return NextResponse.json({ answer: fallback });
  }
  const intent = await classifyIntent({ openai, messages, latestUserPrompt });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sixMonthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  let transactions: TxLike[] = [];
  let categories: Array<{
    id: string;
    name: string;
    essential: boolean;
    monthlyBudget: number | null;
  }> = [];
  let accounts: Array<{
    id: string;
    name: string;
    type: string;
    subtype: string | null;
    institutionName: string | null;
    currentBalance: number | null;
    availableBalance: number | null;
  }> = [];
  let goals: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    target: number;
    current: number;
    minPayment: number | null;
    interestRate: number | null;
    termMonths: number | null;
    endDate: Date | null;
    accountId: string | null;
  }> = [];

  if (intent.needsPersonalData) {
    const txWhere = intent.transactionDetailMode
      ? {
          userId: user.id,
          date: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
        }
      : { userId: user.id, date: { gte: sixMonthStart } };

    [transactions, categories, accounts, goals] = await Promise.all([
      prisma.transaction.findMany({
        where: txWhere,
        include: { splits: true },
        orderBy: { date: "desc" },
        take: intent.transactionDetailMode ? 300 : 200,
      }) as Promise<TxLike[]>,
      prisma.category.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, essential: true, monthlyBudget: true },
      }),
      prisma.account.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          type: true,
          subtype: true,
          institutionName: true,
          currentBalance: true,
          availableBalance: true,
        },
      }),
      prisma.goal.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          target: true,
          current: true,
          minPayment: true,
          interestRate: true,
          termMonths: true,
          endDate: true,
          accountId: true,
        },
      }),
    ]);
  }

  const accountMap = new Map(
    accounts.map((account) => [
      account.id,
      { type: account.type, subtype: account.subtype, name: account.name },
    ])
  );
  const categoryMap = new Map(
    categories.map((item) => [normalizeCategory(item.name), item])
  );

  const expandedTransactions = expandTransactionsWithSplits(transactions);
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

  const context: Record<string, unknown> = {
    generatedAt: now.toISOString(),
    userScope: {
      mode: intent.mode,
      latestUserPrompt,
      intent,
    },
    coverage: {
      transactions: transactions.length,
      accounts: accounts.length,
      categories: categories.length,
      goals: goals.length,
      monthsAnalyzed: monthlySeries.length,
    },
    privacy: {
      note:
        "Use minimum necessary context per user request. Prefer aggregated financial context unless transaction-level detail is required.",
      includesTransactionLevelData: intent.transactionDetailMode,
    },
    safety: {
      reminder:
        "For coaching only. No tax, legal, or investment product advice.",
    },
  };

  if (intent.needsPersonalData) {
    context.cashflow = {
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
    };

    context.categories = {
      topSpend: topCategories.slice(0, 10),
      topFlexible,
      risingCategories,
      overBudgetCategories,
      essentialCategoryCount: categories.filter((item) => item.essential).length,
    };

    context.transfers = {
      internalTransferOutflowMonthToDate: monthSeries.internalTransferOutflow,
      matchedInternalTransfers: transferMatch.internalIds.size,
    };

    context.savingsAndInvestments = {
      totalSavingsBalances: savingsAccountsTotal,
      totalInvestmentBalances: investmentAccountsTotal,
      totalNonDebtAssets: assetTotal,
      estimatedTransfersMonthToDate: {
        toSavingsOrInvestments: roundMoney(transferToSavingsMonth),
      },
    };

    if (intent.asksDebt || intent.asksGoals || goals.length > 0) {
      context.debt = {
        hasDebtData: debtAccounts.length > 0 || activeDebtGoals.length > 0,
        totalBalance: debtTotal,
        debtAccounts: debtAccounts.slice(0, 10),
        activeDebtGoals,
        estimatedMonthlyPayments: {
          fromGoalMinimums: minPaymentsFromGoals,
          fromInternalTransfersMonthToDate: roundMoney(transferToDebtMonth),
          fromDebtTaggedTransactionsMonthToDate: debtPaymentsByCategory,
        },
      };
    }

    if (intent.transactionDetailMode) {
      context.transactionDetails = {
        note: "User requested transaction-level detail.",
        recentTransactions: transactions.slice(0, 50).map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString().slice(0, 10),
          amount: roundMoney(tx.amount),
          category: normalizeCategory(tx.category),
          merchant: tx.merchantName ?? tx.name,
          transactionType: tx.transactionType ?? null,
          splits:
            tx.splits?.map((split) => ({
              id: split.id,
              category: normalizeCategory(split.category),
              amount: roundMoney(split.amount),
            })) ?? [],
        })),
      };
    }
  }

  const systemPrompt = [
    "You are LEDGR, a financial coaching assistant.",
    "Answer with the minimum scope of user financial context required for the current question.",
    "If userScope.mode is aggregated_financial_context, do not claim transaction-level certainty.",
    "If userScope.mode is transaction_detail, you may reference recentTransactions from transactionDetails.",
    "When asked about data access, answer from userScope, coverage, and privacy fields.",
    "For debt questions, use debt section first when available.",
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
    ...messages,
  ];

  if (streamRequested) {
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
