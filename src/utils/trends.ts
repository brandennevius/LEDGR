import type { Transaction } from "../data/mockData";

export type TrendTransaction = {
  amount: number;
  date: string | Date;
  category?: string | null;
};

type CategoryTotals = Record<string, number>;

export type CategoryDrift = {
  name: string;
  current: number;
  previous: number;
  changePct: number;
};

export type ClientSnapshot = {
  asOf: Date;
  totalCurrent: number;
  totalPrevious: number;
  totalChangePct: number;
  volatility: number;
  volatilityLabel: string;
  dailySpend: number[];
  cashOnHand: number;
  avgDailySpend: number;
  bufferDays: number;
  categoryDrift: CategoryDrift[];
  topDrift: CategoryDrift | null;
  lateNightDining: number;
  subscriptionChangePct: number;
  aiHighlights: string[];
  aiActions: string[];
};

const addDays = (date: Date, offset: number) => {
  const next = new Date(date);
  next.setDate(date.getDate() + offset);
  return next;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const inRange = (date: Date, start: Date, end: Date) =>
  date >= start && date <= end;

const sumExpenses = (transactions: TrendTransaction[]) =>
  transactions.reduce((acc, tx) => (tx.amount < 0 ? acc + Math.abs(tx.amount) : acc), 0);

const mean = (values: number[]) =>
  values.reduce((acc, value) => acc + value, 0) / (values.length || 1);

const stdDev = (values: number[]) => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
};

const buildCategoryTotals = (transactions: TrendTransaction[]) =>
  transactions.reduce<CategoryTotals>((acc, tx) => {
    if (tx.amount >= 0) return acc;
    const category = tx.category ?? "Uncategorized";
    acc[category] = (acc[category] ?? 0) + Math.abs(tx.amount);
    return acc;
  }, {});

const buildDailySpend = (transactions: TrendTransaction[], start: Date, days: number) => {
  const daily = Array.from({ length: days }, () => 0);
  transactions.forEach((tx) => {
    if (tx.amount >= 0) return;
    const date = startOfDay(new Date(tx.date));
    const offset = Math.floor((date.getTime() - start.getTime()) / 86400000);
    if (offset >= 0 && offset < days) {
      daily[offset] += Math.abs(tx.amount);
    }
  });
  return daily;
};

const buildDrift = (current: CategoryTotals, previous: CategoryTotals) => {
  const names = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const drift: CategoryDrift[] = [];
  names.forEach((name) => {
    const currentValue = current[name] ?? 0;
    const previousValue = previous[name] ?? 0;
    const changePct =
      previousValue === 0 ? (currentValue > 0 ? 100 : 0) : ((currentValue - previousValue) / previousValue) * 100;
    drift.push({ name, current: currentValue, previous: previousValue, changePct });
  });
  return drift.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
};

const buildAiSummary = (snapshot: Omit<ClientSnapshot, "aiHighlights" | "aiActions">) => {
  const highlights: string[] = [];
  const actions: string[] = [];

  if (snapshot.totalChangePct < 0) {
    highlights.push("Total spend is down compared to last cycle.");
  } else {
    highlights.push("Total spend increased compared to last cycle.");
  }

  if (snapshot.volatilityLabel === "High") {
    highlights.push("Spending volatility is elevated this cycle.");
    actions.push("Add a weekly reset budget to smooth out spikes.");
  } else if (snapshot.volatilityLabel === "Low") {
    highlights.push("Spending volatility continues to decline.");
  }

  if (snapshot.bufferDays < 10) {
    highlights.push("Buffer days are below the safety target.");
    actions.push("Move 10% of next paycheck to buffer savings.");
  }

  if (snapshot.subscriptionChangePct > 20) {
    highlights.push("Subscriptions jumped sharply this cycle.");
    actions.push("Review recurring charges and cancel two unused services.");
  }

  if (snapshot.lateNightDining >= 3) {
    highlights.push("Late-night dining spikes are repeating after payday.");
    actions.push("Set a post-9pm dining rule for this cycle.");
  }

  if (snapshot.topDrift && Math.abs(snapshot.topDrift.changePct) > 15) {
    highlights.push(
      `${snapshot.topDrift.name} is drifting ${snapshot.topDrift.changePct > 0 ? "up" : "down"} by ${Math.abs(
        snapshot.topDrift.changePct
      ).toFixed(0)}%.`
    );
  }

  if (actions.length < 3) {
    actions.push("Route surplus into the highest-interest debt balance.");
  }

  return {
    highlights: highlights.slice(0, 3),
    actions: actions.slice(0, 3),
  };
};

export const buildClientSnapshot = ({
  asOf,
  transactions,
  cashOnHand,
  cycleDays = 14,
  spendIsPositive = false,
}: {
  asOf: Date;
  transactions: TrendTransaction[];
  cashOnHand: number;
  cycleDays?: number;
  spendIsPositive?: boolean;
}): ClientSnapshot => {
  const normalized = spendIsPositive
    ? transactions.map((tx) => ({
        ...tx,
        amount: tx.amount > 0 ? -tx.amount : Math.abs(tx.amount),
      }))
    : transactions;
  const cycleEnd = startOfDay(asOf);
  const cycleStart = addDays(cycleEnd, -cycleDays + 1);
  const previousEnd = addDays(cycleStart, -1);
  const previousStart = addDays(previousEnd, -cycleDays + 1);

  const currentTx = normalized.filter((tx) =>
    inRange(new Date(tx.date), cycleStart, cycleEnd)
  );
  const previousTx = normalized.filter((tx) =>
    inRange(new Date(tx.date), previousStart, previousEnd)
  );

  const totalCurrent = sumExpenses(currentTx);
  const totalPrevious = sumExpenses(previousTx);
  const totalChangePct =
    totalPrevious === 0 ? 0 : ((totalCurrent - totalPrevious) / totalPrevious) * 100;

  const dailySpend = buildDailySpend(currentTx, cycleStart, cycleDays);
  const volatility = stdDev(dailySpend);
  const volatilityLabel = volatility < 18 ? "Low" : volatility < 28 ? "Moderate" : "High";

  const avgDailySpend = mean(dailySpend);
  const bufferDays = avgDailySpend === 0 ? 0 : cashOnHand / avgDailySpend;

  const currentTotals = buildCategoryTotals(currentTx);
  const previousTotals = buildCategoryTotals(previousTx);
  const categoryDrift = buildDrift(currentTotals, previousTotals);
  const topDrift = categoryDrift[0] ?? null;

  const lateNightDining = currentTx.filter((tx) => {
    if ((tx.category ?? "Uncategorized") !== "Dining") return false;
    const hour = new Date(tx.date).getHours();
    return hour >= 21;
  }).length;

  const subscriptionCurrent = currentTotals["Subscriptions"] ?? 0;
  const subscriptionPrevious = previousTotals["Subscriptions"] ?? 0;
  const subscriptionChangePct =
    subscriptionPrevious === 0
      ? subscriptionCurrent > 0
        ? 100
        : 0
      : ((subscriptionCurrent - subscriptionPrevious) / subscriptionPrevious) * 100;

  const baseSnapshot = {
    asOf,
    totalCurrent,
    totalPrevious,
    totalChangePct,
    volatility,
    volatilityLabel,
    dailySpend,
    cashOnHand,
    avgDailySpend,
    bufferDays,
    categoryDrift,
    topDrift,
    lateNightDining,
    subscriptionChangePct,
  };

  const summary = buildAiSummary(baseSnapshot);

  return {
    ...baseSnapshot,
    aiHighlights: summary.highlights,
    aiActions: summary.actions,
  };
};
