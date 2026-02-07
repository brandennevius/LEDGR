import { prisma } from "@/lib/db";
import {
  asOfDate,
  mockAccounts,
  mockClient,
  mockGoals,
  mockTransactions,
} from "@/data/mockData";
import { buildClientSnapshot } from "@/utils/trends";
import { categorizeTransactions } from "@/lib/categorize";
import { computeCashOnHand, hydrateGoals } from "@/lib/goals";
import type { User } from "@prisma/client";

const incomePattern = /income|payroll|salary|wages|benefit|deposit|refund/i;
const transferPattern = /transfer|payment|p2p|venmo|cash app|zelle/i;
const investmentPattern =
  /invest|investment|brokerage|401k|403b|ira|roth|vanguard|fidelity|schwab|etrade|td ameritrade|betterment|wealthfront/i;

const formatDay = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const getDisplayName = (user: User) => {
  if (user.name?.trim()) return user.name;
  if (user.email?.includes("@")) return user.email.split("@")[0];
  return "Client";
};

const normalizeCategory = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

const isIncomeTransaction = (tx: {
  amount: number;
  category?: string | null;
  name?: string | null;
  merchantName?: string | null;
}) => {
  const category = normalizeCategory(tx.category);
  const name = (tx.merchantName ?? tx.name ?? "").toLowerCase();
  return (
    tx.amount < 0 || incomePattern.test(category) || incomePattern.test(name)
  );
};

const isTransferTransaction = (tx: {
  category?: string | null;
  name?: string | null;
  merchantName?: string | null;
}) => {
  const category = normalizeCategory(tx.category);
  const name = (tx.merchantName ?? tx.name ?? "").toLowerCase();
  return transferPattern.test(category) || transferPattern.test(name);
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const computeIncomeForecast = (
  transactions: Array<{
    amount: number;
    date: Date;
    category?: string | null;
    name?: string | null;
    merchantName?: string | null;
  }>,
  override?: number | null
) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 6);

  const incomeTx = transactions
    .filter((tx) => tx.date >= sixMonthsAgo)
    .filter((tx) => isIncomeTransaction(tx) && !isTransferTransaction(tx))
    .map((tx) => ({ ...tx, amount: Math.abs(tx.amount) }))
    .filter((tx) => tx.amount >= 20)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const actualMonthIncome = incomeTx
    .filter((tx) => tx.date >= monthStart)
    .reduce((acc, tx) => acc + tx.amount, 0);

  const incomeTxRecent = incomeTx.filter((tx) => tx.date >= sixtyDaysAgo);
  const intervals: number[] = [];
  for (let i = 1; i < incomeTxRecent.length; i += 1) {
    const diffDays = Math.round(
      (incomeTxRecent[i].date.getTime() -
        incomeTxRecent[i - 1].date.getTime()) /
        86400000
    );
    if (diffDays > 0) intervals.push(diffDays);
  }

  let expectedMonthlyIncome = 0;
  if (intervals.length >= 3) {
    const medianDays = median(intervals);
    let periodsPerMonth = 1;
    if (medianDays <= 8) periodsPerMonth = 4.33;
    else if (medianDays <= 15) periodsPerMonth = 2.17;
    else if (medianDays <= 20) periodsPerMonth = 2;

    const recentAmounts = incomeTxRecent
      .slice(-8)
      .map((tx) => tx.amount);
    const paycheck = median(recentAmounts) || median(incomeTx.map((tx) => tx.amount));
    expectedMonthlyIncome = paycheck * periodsPerMonth;
  } else {
    const monthTotals = new Map<string, number>();
    incomeTx.forEach((tx) => {
      const key = `${tx.date.getFullYear()}-${tx.date.getMonth()}`;
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + tx.amount);
    });
    const totals = Array.from(monthTotals.values())
      .slice(-3)
      .filter((value) => value > 0);
    expectedMonthlyIncome =
      totals.length > 0
        ? totals.reduce((acc, value) => acc + value, 0) / totals.length
        : actualMonthIncome;
  }

  if (override && override > 0) {
    expectedMonthlyIncome = override;
  }

  expectedMonthlyIncome = Math.max(0, Math.round(expectedMonthlyIncome));
  const remaining = Math.max(0, expectedMonthlyIncome - actualMonthIncome);
  const variance = actualMonthIncome - expectedMonthlyIncome;
  const progress =
    expectedMonthlyIncome > 0
      ? Math.min(1, actualMonthIncome / expectedMonthlyIncome)
      : 0;

  return {
    actual: Math.round(actualMonthIncome),
    expected: expectedMonthlyIncome,
    remaining: Math.round(remaining),
    variance: Math.round(variance),
    progress,
  };
};

const serializeGoal = (goal: {
  id?: string;
  name: string;
  type?: string | null;
  cadence?: string | null;
  category?: string | null;
  accountId?: string | null;
  minPayment?: number | null;
  interestRate?: number | null;
  termMonths?: number | null;
  status?: string | null;
  current: number;
  target: number;
}) => ({
  id: goal.id,
  name: goal.name,
  type: goal.type ?? "SAVINGS",
  cadence: goal.cadence ?? "MONTHLY",
  category: goal.category ?? undefined,
  accountId: goal.accountId ?? undefined,
  minPayment: goal.minPayment ?? undefined,
  interestRate: goal.interestRate ?? undefined,
  termMonths: goal.termMonths ?? undefined,
  status: goal.status ?? "ACTIVE",
  current: goal.current,
  target: goal.target,
});

export const getClientOverviewData = async (user: User) => {
  let [accounts, goals, transactions, categorySettings, activeItem] =
    await Promise.all([
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.goal.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({ where: { userId: user.id } }),
    prisma.category.findMany({ where: { userId: user.id } }),
    prisma.plaidItem.findFirst({
      where: { userId: user.id, status: "active" },
    }),
  ]);
  const latestReview = await prisma.coachReview.findFirst({
    where: { clientId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const review =
    latestReview && {
      highlights: latestReview.highlights,
      actions: latestReview.actions,
      notes: latestReview.notes,
      approvedAt: latestReview.approvedAt?.toISOString() ?? null,
    };

  if (transactions.length === 0 || accounts.length === 0) {
    const cashOnHand = mockAccounts.reduce((acc, account) => {
      if (account.type === "credit") return acc - account.balance;
      return acc + account.balance;
    }, 0);
    const snapshot = buildClientSnapshot({
      asOf: asOfDate,
      transactions: mockTransactions,
      cashOnHand,
    });
    const now = new Date(asOfDate);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const daysElapsed = Math.max(
      1,
      Math.floor((now.getTime() - monthStart.getTime()) / 86400000) + 1
    );
    const monthDaily = Array.from({ length: daysInMonth }, () => 0);
    const monthDailyIncome = Array.from({ length: daysInMonth }, () => 0);
    const monthCategories = new Map<string, number>();
    const recentTransactions = mockTransactions
      .slice(0, 8)
      .map((tx) => ({
        id: tx.id,
        name: tx.merchant,
        category: tx.category,
        amount: Math.abs(tx.amount),
        isIncome: tx.amount > 0,
        date: new Date(tx.date).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
        }),
      }));

    mockTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      if (date < monthStart) return;
      if (tx.amount < 0) {
        const dayIndex = date.getDate() - 1;
        monthDaily[dayIndex] += Math.abs(tx.amount);
        monthCategories.set(
          tx.category,
          (monthCategories.get(tx.category) ?? 0) + Math.abs(tx.amount)
        );
      }
      if (isIncomeTransaction(tx) && !isTransferTransaction(tx)) {
        const dayIndex = date.getDate() - 1;
        monthDailyIncome[dayIndex] += Math.abs(tx.amount);
      }
    });

    const monthCumulative = monthDaily.reduce<number[]>((acc, value, index) => {
      acc[index] = value + (acc[index - 1] ?? 0);
      return acc;
    }, []);
    const monthIncomeCumulative = monthDailyIncome.reduce<number[]>(
      (acc, value, index) => {
        acc[index] = value + (acc[index - 1] ?? 0);
        return acc;
      },
      []
    );
    const monthSpendTotal = monthDaily.reduce((acc, value) => acc + value, 0);
    const categoryMonthSummary = Array.from(monthCategories.entries())
      .map(([name, spend]) => ({
        name,
        spend,
        budget: null as number | null,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6);
    const assetsTotal = mockAccounts
      .filter((account) => account.type !== "credit")
      .reduce((acc, account) => acc + account.balance, 0);
    const debtTotal = mockAccounts
      .filter((account) => account.type === "credit")
      .reduce((acc, account) => acc + Math.abs(account.balance), 0);
    const mockDebtGoal = mockGoals.find((goal) => goal.type === "DEBT");
    const mockDebtRemaining = mockDebtGoal
      ? Math.max(0, mockDebtGoal.target - mockDebtGoal.current)
      : 0;
    const mockBasePayment = mockDebtRemaining > 0 ? 300 : 0;
    const mockMonthsRemaining =
      mockDebtRemaining > 0 && mockBasePayment > 0
        ? Math.ceil(mockDebtRemaining / mockBasePayment)
        : 0;
    const incomeSummary = computeIncomeForecast(
      mockTransactions.map((tx) => ({
        amount: tx.amount,
        date: new Date(tx.date),
        category: tx.category,
        name: tx.merchant,
      })),
      user.monthlyIncomeOverride
    );

    return {
      clientName: getDisplayName(user) ?? mockClient.name,
      clientId: user.id,
      snapshot,
      goals: (goals.length ? goals : mockGoals).map(serializeGoal),
      accounts: mockAccounts.map((account) => ({
        name: account.name,
        type: account.type,
        mask: undefined,
        institutionName: "Demo Bank",
        balance: account.balance,
      })),
      review,
      budgetSnapshot: {
        essentialsSpend: 0,
        essentialsBudget: 0,
        flexibleSpend: 0,
        flexibleBudget: 0,
        totalBudget: 0,
        totalSpend: 0,
        overBudgetCategories: 0,
      },
      categoryBudgets: [],
      categoryMonthSummary,
      recentTransactions,
      assetsTotal,
      debtTotal,
      monthDailySpend: monthCumulative,
      monthDailyIncome: monthIncomeCumulative,
      monthSpendTotal,
      monthBudgetTotal: 0,
      monthDaysElapsed: daysElapsed,
      debtProjection: {
        remaining: mockDebtRemaining,
        basePayment: mockBasePayment,
        monthsRemaining: mockMonthsRemaining,
      },
      budgetRecommendations: [],
      incomeSummary,
      connectionStatus: {
        state: "disconnected" as const,
        title: "Connect a bank to unlock live data.",
        description: "Link your accounts to sync transactions and income.",
      },
      hasBankData: false,
    };
  }

  const categorizedCount = transactions.filter((tx) => tx.category).length;
  if (categorizedCount === 0 && process.env.OPENAI_API_KEY) {
    await categorizeTransactions({ userId: user.id, limit: 80 });
    transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
    });
  }

  const cashOnHand = computeCashOnHand(accounts);
  const snapshot = buildClientSnapshot({
    asOf: new Date(),
    transactions: transactions.map((tx) => ({
      amount: tx.amount,
      date: tx.date,
      category: tx.category,
    })),
    cashOnHand,
    spendIsPositive: true,
  });

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 30);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysElapsed = Math.max(
    1,
    Math.floor((now.getTime() - monthStart.getTime()) / 86400000) + 1
  );
  const daysInMonth = monthEnd.getDate();
  const monthDaily = Array.from({ length: daysInMonth }, () => 0);
  const monthDailyIncome = Array.from({ length: daysInMonth }, () => 0);

  const categoryTotals = new Map<string, number>();
  transactions.forEach((tx) => {
    if (tx.amount <= 0) return;
    if (isIncomeTransaction(tx) || isTransferTransaction(tx)) return;
    if (tx.date < windowStart) return;
    const category = tx.category ?? "Uncategorized";
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + tx.amount);
  });

  const monthCategoryTotals = new Map<string, number>();
  transactions.forEach((tx) => {
    if (tx.amount <= 0) return;
    if (isIncomeTransaction(tx) || isTransferTransaction(tx)) return;
    if (tx.date < monthStart) return;
    const category = tx.category ?? "Uncategorized";
    monthCategoryTotals.set(
      category,
      (monthCategoryTotals.get(category) ?? 0) + tx.amount
    );
    const dayIndex = tx.date.getDate() - 1;
    monthDaily[dayIndex] += tx.amount;
  });

  transactions.forEach((tx) => {
    if (!isIncomeTransaction(tx) || isTransferTransaction(tx)) return;
    if (tx.date < monthStart) return;
    const dayIndex = tx.date.getDate() - 1;
    monthDailyIncome[dayIndex] += Math.abs(tx.amount);
  });

  const essentialsBudget = categorySettings
    .filter((setting) => setting.essential)
    .reduce((acc, setting) => acc + (setting.monthlyBudget ?? 0), 0);
  const flexibleBudget = categorySettings
    .filter((setting) => !setting.essential)
    .reduce((acc, setting) => acc + (setting.monthlyBudget ?? 0), 0);
  const totalBudget = essentialsBudget + flexibleBudget;

  let essentialsSpend = 0;
  let flexibleSpend = 0;
  let overBudgetCategories = 0;
  const settingsMap = new Map(
    categorySettings.map((setting) => [setting.name, setting])
  );

  categoryTotals.forEach((spend, name) => {
    const setting = settingsMap.get(name);
    const isEssential = setting?.essential ?? false;
    const budget = setting?.monthlyBudget ?? 0;
    if (isEssential) {
      essentialsSpend += spend;
    } else {
      flexibleSpend += spend;
    }
    if (budget > 0 && spend > budget) {
      overBudgetCategories += 1;
    }
  });

  const categoryBudgets = categorySettings
    .filter((setting) => setting.monthlyBudget || setting.essential)
    .map((setting) => {
      const spend = monthCategoryTotals.get(setting.name) ?? 0;
      const budget = setting.monthlyBudget ?? 0;
      const projected = budget > 0 ? (spend / daysElapsed) * daysInMonth : 0;
      const remaining = budget - spend;
      const status: "over" | "risk" | "ok" =
        budget > 0 && spend > budget
          ? "over"
          : budget > 0 && projected > budget
          ? "risk"
          : "ok";
      return {
        name: setting.name,
        essential: setting.essential,
        budget,
        spend,
        projected,
        remaining,
        status,
      };
    })
    .sort((a, b) => {
      if (a.essential !== b.essential) return a.essential ? -1 : 1;
      return b.spend - a.spend;
    });

  let categorySummaryLabel = "Month-to-date spend by category.";
  let summarySource = monthCategoryTotals;
  if (summarySource.size === 0 && categoryTotals.size > 0) {
    categorySummaryLabel = "Last 30 days spend by category.";
    summarySource = categoryTotals;
  }

  const categoryMonthSummary = Array.from(summarySource.entries())
    .map(([name, spend]) => ({
      name,
      spend,
      budget: settingsMap.get(name)?.monthlyBudget ?? null,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6);

  const monthCumulative = monthDaily.reduce<number[]>((acc, value, index) => {
    acc[index] = value + (acc[index - 1] ?? 0);
    return acc;
  }, []);
  const monthIncomeCumulative = monthDailyIncome.reduce<number[]>(
    (acc, value, index) => {
      acc[index] = value + (acc[index - 1] ?? 0);
      return acc;
    },
    []
  );
  const monthSpendTotal = monthDaily.reduce((acc, value) => acc + value, 0);

  const incomeSummary = computeIncomeForecast(
    transactions.map((tx) => ({
      amount: tx.amount,
      date: tx.date,
      category: tx.category,
      name: tx.name,
      merchantName: tx.merchantName,
    })),
    user.monthlyIncomeOverride
  );

  const hydratedGoals = goals.length
    ? hydrateGoals({
        goals,
        transactions,
        accounts,
        bufferDays: snapshot.bufferDays,
      })
    : [];
  const activeGoals = hydratedGoals.filter(
    (goal) => goal.status !== "COMPLETED"
  );

  const debtPattern = /loan|debt|credit|card payment|payment|mortgage|student/i;
  const debtGoal = activeGoals.find(
    (goal) => goal.type === "DEBT" && goal.target > goal.current
  );
  const debtRemaining = debtGoal
    ? Math.max(0, debtGoal.target - debtGoal.current)
    : 0;
  const debtPayments = transactions
    .filter((tx) => {
      if (tx.amount <= 0) return false;
      if (tx.date < monthStart) return false;
      const category = tx.category?.toLowerCase() ?? "";
      const name = (tx.merchantName ?? tx.name).toLowerCase();
      return debtPattern.test(category) || debtPattern.test(name);
    })
    .reduce((acc, tx) => acc + tx.amount, 0);
  const baseDebtPayment =
    debtRemaining > 0 ? Math.max(debtPayments, 100) : 0;
  const monthsRemaining =
    debtRemaining > 0 && baseDebtPayment > 0
      ? Math.ceil(debtRemaining / baseDebtPayment)
      : 0;

  const recentTransactions = transactions
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8)
    .map((tx) => ({
      id: tx.id,
      name: tx.merchantName ?? tx.name,
      category: tx.category ?? "Uncategorized",
      amount: Math.abs(tx.amount),
      isIncome: tx.amount < 0,
      date: formatDay(tx.date),
    }));
  const assetsTotal = accounts
    .filter((account) => account.type !== "credit")
    .reduce(
      (acc, account) =>
        acc + (account.currentBalance ?? account.availableBalance ?? 0),
      0
    );
  const debtTotal = accounts
    .filter((account) => account.type === "credit" || account.type === "loan")
    .reduce(
      (acc, account) =>
        acc + Math.abs(account.currentBalance ?? account.availableBalance ?? 0),
      0
    );

  const budgetRecommendations: string[] = [];
  const flexibleCandidates = categoryBudgets.filter((item) => !item.essential);
  const candidate =
    flexibleCandidates.find((item) => item.status === "over") ??
    flexibleCandidates.find((item) => item.status === "risk") ??
    flexibleCandidates[0];

  if (candidate && candidate.spend > 0) {
    const overage =
      candidate.budget > 0 ? Math.max(0, candidate.projected - candidate.budget) : 0;
    let cut = overage > 0 ? overage : candidate.spend * 0.1;
    cut = Math.round(cut / 10) * 10;

    if (cut >= 10) {
      if (debtRemaining > 0) {
        const monthsWith = Math.ceil(debtRemaining / (baseDebtPayment + cut));
        const sooner = Math.max(0, monthsRemaining - monthsWith);
        if (sooner > 0) {
          budgetRecommendations.push(
            `Trim ${candidate.name} by ${formatCurrency(
              cut
            )}/mo and redirect it to debt to finish about ${sooner} months sooner.`
          );
        } else {
          budgetRecommendations.push(
            `Trim ${candidate.name} by ${formatCurrency(
              cut
            )}/mo to add momentum toward your debt payoff.`
          );
        }
      } else {
        budgetRecommendations.push(
          `Trim ${candidate.name} by ${formatCurrency(
            cut
          )}/mo to accelerate your top goal.`
        );
      }
    }
  }

  const connectionStatus =
    activeItem && accounts.length > 0
      ? { state: "connected" as const, title: "", description: "" }
      : activeItem
      ? {
          state: "attention" as const,
          title: "We’re having trouble syncing.",
          description:
            "Reconnect your bank to keep transactions and balances up to date.",
        }
      : {
          state: "disconnected" as const,
          title: "Bank connection needed.",
          description: "Link your accounts to keep data fresh.",
        };

  return {
    clientName: getDisplayName(user),
    clientId: user.id,
    snapshot,
    goals: (activeGoals.length ? activeGoals : mockGoals).map(serializeGoal),
    accounts: accounts.map((account) => ({
      name: account.name,
      type: account.type,
      mask: account.mask ?? undefined,
      institutionName: account.institutionName ?? undefined,
      balance: account.currentBalance ?? account.availableBalance ?? 0,
    })),
    review,
    budgetSnapshot: {
      essentialsSpend,
      essentialsBudget,
      flexibleSpend,
      flexibleBudget,
      totalBudget,
      totalSpend: essentialsSpend + flexibleSpend,
      overBudgetCategories,
    },
    categoryBudgets,
    categoryMonthSummary,
    categorySummaryLabel,
    recentTransactions,
    assetsTotal,
    debtTotal,
    monthDailySpend: monthCumulative,
    monthDailyIncome: monthIncomeCumulative,
    monthSpendTotal,
    monthBudgetTotal: totalBudget,
    monthDaysElapsed: daysElapsed,
    debtProjection: {
      remaining: debtRemaining,
      basePayment: baseDebtPayment,
      monthsRemaining,
    },
    budgetRecommendations,
    incomeSummary,
    connectionStatus,
    hasBankData: true,
  };
};

export const getCoachDashboardData = async (user: User) => {
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 5,
    }),
  ]);

  if (transactions.length === 0 || accounts.length === 0) {
    return {
      clientName: getDisplayName(user) ?? mockClient.name,
      netWorth: 38240,
      monthlySurplus: 420,
      bufferDays: 12.4,
      recentTransactions: mockTransactions.slice(0, 5).map((tx) => ({
        name: tx.merchant,
        category: tx.category,
        amount: Math.abs(tx.amount),
        isIncome: tx.amount > 0,
        day: "Recent",
      })),
    };
  }

  const netWorth = accounts.reduce((acc, account) => {
    const balance = account.currentBalance ?? 0;
    if (account.type === "credit") return acc - balance;
    return acc + balance;
  }, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const monthTx = await prisma.transaction.findMany({
    where: { userId: user.id, date: { gte: thirtyDaysAgo } },
  });

  const income = monthTx
    .filter((tx) => tx.amount < 0)
    .reduce((acc, tx) => acc + Math.abs(tx.amount), 0);
  const spend = monthTx
    .filter((tx) => tx.amount > 0)
    .reduce((acc, tx) => acc + tx.amount, 0);

  const cashOnHand = computeCashOnHand(accounts);
  const snapshot = buildClientSnapshot({
    asOf: new Date(),
    transactions: monthTx.map((tx) => ({
      amount: tx.amount,
      date: tx.date,
      category: tx.category,
    })),
    cashOnHand,
    spendIsPositive: true,
  });

  return {
    clientName: getDisplayName(user),
    netWorth: Number(netWorth.toFixed(0)),
    monthlySurplus: Number((income - spend).toFixed(0)),
    bufferDays: snapshot.bufferDays,
    recentTransactions: transactions.map((tx) => ({
      name: tx.merchantName ?? tx.name,
      category: tx.category ?? "Uncategorized",
      amount: Math.abs(tx.amount),
      isIncome: tx.amount < 0,
      day: formatDay(tx.date),
    })),
  };
};

type DistributionCategory = {
  name: string;
  value: number;
};

export const getDistributionData = async (user: User) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, date: { gte: monthStart } },
    orderBy: { date: "desc" },
  });

  const usingMock = transactions.length === 0;
  const fallbackTransactions = usingMock
    ? mockTransactions.map((tx) => {
        const category = tx.category ?? "Uncategorized";
        const isMockIncome =
          incomePattern.test(category.toLowerCase()) ||
          incomePattern.test(tx.merchant.toLowerCase());
        return {
          amount: isMockIncome ? -Math.abs(tx.amount) : Math.abs(tx.amount),
          category,
          name: tx.merchant,
          merchantName: undefined,
          date: new Date(tx.date),
        };
      })
    : transactions.map((tx) => ({
        amount: tx.amount,
        category: tx.category ?? "Uncategorized",
        name: tx.name,
        merchantName: tx.merchantName ?? undefined,
        date: tx.date,
      }));

  const usableTransactions = fallbackTransactions;

  const incomeTransactions = usableTransactions.filter((tx) =>
    isIncomeTransaction(tx)
  );
  const nonIncomeTransactions = usableTransactions.filter(
    (tx) => !isIncomeTransaction(tx)
  );

  const investmentTransactions = nonIncomeTransactions.filter((tx) => {
    const category = normalizeCategory(tx.category);
    const name = (tx.merchantName ?? tx.name ?? "").toLowerCase();
    return investmentPattern.test(category) || investmentPattern.test(name);
  });

  const transferTransactions = nonIncomeTransactions.filter(
    (tx) =>
      isTransferTransaction(tx) &&
      !investmentTransactions.includes(tx)
  );

  const spendTransactions = nonIncomeTransactions.filter(
    (tx) =>
      !isTransferTransaction(tx) &&
      !investmentTransactions.includes(tx)
  );

  const incomeTotal = incomeTransactions.reduce(
    (acc, tx) => acc + Math.abs(tx.amount),
    0
  );
  const spendTotal = spendTransactions.reduce(
    (acc, tx) => acc + Math.abs(tx.amount),
    0
  );
  const investmentTotal = investmentTransactions.reduce(
    (acc, tx) => acc + Math.abs(tx.amount),
    0
  );
  const transferTotal = transferTransactions.reduce(
    (acc, tx) => acc + Math.abs(tx.amount),
    0
  );

  const categoryMap = new Map<string, number>();
  spendTransactions.forEach((tx) => {
    const category = tx.category?.trim() || "Uncategorized";
    categoryMap.set(
      category,
      (categoryMap.get(category) ?? 0) + Math.abs(tx.amount)
    );
  });

  const sortedCategories = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topCategories = sortedCategories.slice(0, 8);
  const otherTotal = sortedCategories
    .slice(8)
    .reduce((acc, item) => acc + item.value, 0);

  const categories: DistributionCategory[] = [...topCategories];
  if (otherTotal > 0) {
    categories.push({ name: "Other", value: otherTotal });
  }

  const rawSavings = incomeTotal - spendTotal - investmentTotal - transferTotal;
  const savings = Math.max(rawSavings, 0);

  const incomeSourceMap = new Map<string, number>();
  incomeTransactions.forEach((tx) => {
    const name = tx.merchantName ?? tx.name ?? "Income";
    incomeSourceMap.set(name, (incomeSourceMap.get(name) ?? 0) + Math.abs(tx.amount));
  });

  const topIncomeSources = Array.from(incomeSourceMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const incomeOtherTotal = Array.from(incomeSourceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(5)
    .reduce((acc, item) => acc + item[1], 0);

  let incomeSources = [...topIncomeSources];
  if (incomeOtherTotal > 0) {
    incomeSources.push({ name: "Other income", value: incomeOtherTotal });
  }

  const investmentDestinations = new Map<string, number>();
  investmentTransactions.forEach((tx) => {
    const label = tx.merchantName ?? tx.name ?? "Investment";
    investmentDestinations.set(
      label,
      (investmentDestinations.get(label) ?? 0) + Math.abs(tx.amount)
    );
  });

  const transferDestinations = new Map<string, number>();
  transferTransactions.forEach((tx) => {
    const label = tx.merchantName ?? tx.name ?? "Transfer";
    transferDestinations.set(
      label,
      (transferDestinations.get(label) ?? 0) + Math.abs(tx.amount)
    );
  });

  const nodes: Array<{
    id: string;
    label: string;
    value: number;
    column: number;
    color: string;
  }> = [];
  const links: Array<{
    source: string;
    target: string;
    value: number;
    color: string;
  }> = [];

  const totalOutflows = spendTotal + investmentTotal + transferTotal + savings;
  if (incomeTotal <= 0 && totalOutflows > 0) {
    incomeSources = [{ name: "Inflows", value: totalOutflows }];
  }

  incomeSources.forEach((source, index) => {
    nodes.push({
      id: `income-${source.name}`,
      label: source.name,
      value: source.value,
      column: 0,
      color: index % 2 === 0 ? "#0c7a7a" : "#0f766e",
    });
  });

  if (spendTotal > 0) {
    nodes.push({
      id: "allocation-spending",
      label: "Spending",
      value: spendTotal,
      column: 1,
      color: "#d97706",
    });
  }

  if (investmentTotal > 0) {
    nodes.push({
      id: "allocation-investments",
      label: "Investments",
      value: investmentTotal,
      column: 1,
      color: "#7c3aed",
    });
  }

  if (transferTotal > 0) {
    nodes.push({
      id: "allocation-transfers",
      label: "Transfers",
      value: transferTotal,
      column: 1,
      color: "#2563eb",
    });
  }

  if (savings > 0) {
    nodes.push({
      id: "allocation-savings",
      label: "Savings",
      value: savings,
      column: 1,
      color: "#16a34a",
    });
  }

  categories.forEach((category, index) => {
    nodes.push({
      id: `category-${category.name}`,
      label: category.name,
      value: category.value,
      column: 2,
      color: ["#1d4ed8", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#f97316", "#db2777", "#7c3aed"][index % 8],
    });
  });

  Array.from(investmentDestinations.entries()).forEach(([label, value], index) => {
    nodes.push({
      id: `investment-${label}`,
      label,
      value,
      column: 2,
      color: index % 2 === 0 ? "#8b5cf6" : "#a855f7",
    });
  });

  Array.from(transferDestinations.entries()).forEach(([label, value], index) => {
    nodes.push({
      id: `transfer-${label}`,
      label,
      value,
      column: 2,
      color: index % 2 === 0 ? "#60a5fa" : "#3b82f6",
    });
  });

  const inflowDenominator = incomeTotal > 0 ? incomeTotal : totalOutflows;
  if (inflowDenominator > 0) {
    incomeSources.forEach((source) => {
      const sourceId = `income-${source.name}`;
      if (spendTotal > 0) {
        links.push({
          source: sourceId,
          target: "allocation-spending",
          value: (source.value / inflowDenominator) * spendTotal,
          color: "rgba(12, 122, 122, 0.3)",
        });
      }
      if (investmentTotal > 0) {
        links.push({
          source: sourceId,
          target: "allocation-investments",
          value: (source.value / inflowDenominator) * investmentTotal,
          color: "rgba(124, 58, 237, 0.25)",
        });
      }
      if (transferTotal > 0) {
        links.push({
          source: sourceId,
          target: "allocation-transfers",
          value: (source.value / inflowDenominator) * transferTotal,
          color: "rgba(37, 99, 235, 0.2)",
        });
      }
      if (savings > 0) {
        links.push({
          source: sourceId,
          target: "allocation-savings",
          value: (source.value / inflowDenominator) * savings,
          color: "rgba(22, 163, 74, 0.25)",
        });
      }
    });
  }

  categories.forEach((category) => {
    links.push({
      source: "allocation-spending",
      target: `category-${category.name}`,
      value: category.value,
      color: "rgba(15, 118, 110, 0.2)",
    });
  });

  investmentDestinations.forEach((value, label) => {
    links.push({
      source: "allocation-investments",
      target: `investment-${label}`,
      value,
      color: "rgba(124, 58, 237, 0.25)",
    });
  });

  transferDestinations.forEach((value, label) => {
    links.push({
      source: "allocation-transfers",
      target: `transfer-${label}`,
      value,
      color: "rgba(37, 99, 235, 0.2)",
    });
  });

  return {
    clientName: getDisplayName(user),
    rangeLabel: "This month",
    incomeTotal,
    spendTotal,
    investmentTotal,
    transferTotal,
    savings,
    categories,
    nodes,
    links,
  };
};
