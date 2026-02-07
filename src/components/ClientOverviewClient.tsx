"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PlaidLinkButton from "@/components/PlaidLinkButton";
import SignOutButton from "@/components/SignOutButton";
import InsightsChatClient from "@/components/InsightsChatClient";

type Goal = {
  id?: string;
  name: string;
  type?: string;
  cadence?: string;
  current: number;
  target: number;
  accountId?: string;
  minPayment?: number;
};

type Account = {
  name: string;
  type: string;
  mask?: string;
  institutionName?: string;
  balance: number;
};

type DebtProjection = {
  remaining: number;
  basePayment: number;
  monthsRemaining: number;
};

type CategoryBudget = {
  name: string;
  essential: boolean;
  budget: number;
  spend: number;
  projected: number;
  remaining: number;
  status: "ok" | "risk" | "over";
};

type CategoryMonthSummary = {
  name: string;
  spend: number;
  budget: number | null;
};

type RecentTransaction = {
  id: string;
  name: string;
  category: string;
  amount: number;
  isIncome: boolean;
  date: string;
};

type Props = {
  clientName: string;
  goals: Goal[];
  accounts: Account[];
  categoryBudgets?: CategoryBudget[];
  budgetRecommendations?: string[];
  debtProjection?: DebtProjection;
  categoryMonthSummary?: CategoryMonthSummary[];
  categorySummaryLabel?: string;
  recentTransactions?: RecentTransaction[];
  assetsTotal?: number;
  debtTotal?: number;
  monthDailySpend?: number[];
  monthDailyIncome?: number[];
  monthSpendTotal?: number;
  monthBudgetTotal?: number;
  monthDaysElapsed?: number;
  incomeSummary?: {
    actual: number;
    expected: number;
    remaining: number;
    variance: number;
    progress: number;
  };
  connectionStatus?: {
    state: "connected" | "attention" | "disconnected";
    title: string;
    description: string;
  };
  hasBankData: boolean;
};

type GoalSummary = {
  status: "on_track" | "at_risk" | "off_track";
  summary: string;
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

export default function ClientOverviewClient({
  clientName,
  goals,
  accounts,
  categoryBudgets,
  budgetRecommendations,
  debtProjection,
  categoryMonthSummary,
  categorySummaryLabel,
  recentTransactions,
  assetsTotal,
  debtTotal,
  monthDailySpend,
  monthDailyIncome,
  monthSpendTotal,
  monthBudgetTotal,
  monthDaysElapsed,
  incomeSummary,
  connectionStatus,
  hasBankData,
}: Props) {
  const [goalSummary, setGoalSummary] = useState<GoalSummary | null>(null);
  const [goalSummaryLoading, setGoalSummaryLoading] = useState(false);

  const incomeActual = incomeSummary?.actual ?? 0;
  const incomeExpected = incomeSummary?.expected ?? 0;
  const incomeRemaining = incomeSummary?.remaining ?? 0;
  const incomeVariance = incomeSummary?.variance ?? 0;
  const incomeProgress = Math.min(
    100,
    Math.round((incomeSummary?.progress ?? 0) * 100)
  );

  useEffect(() => {
    if (!goals.length) return;
    let isMounted = true;
    setGoalSummaryLoading(true);
    fetch("/api/goals/summary", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.summary) {
          setGoalSummary(data);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setGoalSummary(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setGoalSummaryLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [goals.length]);

  const flexibleBudgets = useMemo(
    () =>
      (categoryBudgets ?? []).filter(
        (item) => !item.essential && (item.budget > 0 || item.spend > 0)
      ),
    [categoryBudgets]
  );
  const [selectedBudgetName, setSelectedBudgetName] = useState(
    flexibleBudgets[0]?.name ?? ""
  );
  const [sliderValue, setSliderValue] = useState(
    flexibleBudgets[0]?.budget || flexibleBudgets[0]?.spend || 0
  );

  useEffect(() => {
    if (!flexibleBudgets.length) return;
    if (!selectedBudgetName) {
      const first = flexibleBudgets[0];
      setSelectedBudgetName(first.name);
      setSliderValue(first.budget || first.spend || 0);
      return;
    }
    const match = flexibleBudgets.find(
      (item) => item.name === selectedBudgetName
    );
    if (!match) {
      const first = flexibleBudgets[0];
      setSelectedBudgetName(first.name);
      setSliderValue(first.budget || first.spend || 0);
    }
  }, [flexibleBudgets, selectedBudgetName]);

  const selectedBudget = flexibleBudgets.find(
    (item) => item.name === selectedBudgetName
  );
  const sliderMax = selectedBudget
    ? Math.max(selectedBudget.spend, selectedBudget.budget || 0, 100) * 1.5
    : 0;
  const sliderMin = 0;
  const baselineSpend = selectedBudget?.spend ?? 0;
  const changeAmount = baselineSpend - sliderValue;
  const basePayment = debtProjection?.basePayment ?? 0;
  const debtRemaining = debtProjection?.remaining ?? 0;
  const monthsNow = debtProjection?.monthsRemaining ?? 0;
  const newPayment = basePayment + changeAmount;
  const monthsWith =
    debtRemaining > 0 && newPayment > 0
      ? Math.ceil(debtRemaining / newPayment)
      : 0;
  const monthsDelta = monthsNow && monthsWith ? monthsNow - monthsWith : 0;

  const categorySpendMax = useMemo(() => {
    const values = (categoryMonthSummary ?? []).map((item) =>
      item.budget ? item.budget : item.spend
    );
    return Math.max(...values, 1);
  }, [categoryMonthSummary]);

  const sortedCategories = useMemo(() => {
    const items = [...(categoryMonthSummary ?? [])];
    items.sort((a, b) => b.spend - a.spend);
    return items.slice(0, 6);
  }, [categoryMonthSummary]);

  const monthSpend = monthSpendTotal ?? 0;
  const monthBudget = monthBudgetTotal ?? 0;
  const budgetCoverage =
    monthBudget > 0 && monthSpend > 0 ? monthBudget / monthSpend : 0;
  const showBudget = monthBudget > 0 && budgetCoverage >= 0.5;
  const budgetRemaining = showBudget ? monthBudget - monthSpend : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[6%] h-[360px] w-[360px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[14%] h-[320px] w-[320px] rounded-full bg-amber-100/60 blur-[120px]" />

      <div className="flex w-full gap-5 px-3 pb-24 pt-8 md:px-4 lg:px-6 2xl:px-8">
        <aside className="hidden w-56 shrink-0 flex-col gap-5 xl:flex">
          <div className="rounded-3xl bg-white/80 p-4 ring-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--ocean)] text-white">
                A
              </div>
              <div>
                <p className="text-sm font-semibold">Arbor</p>
                <p className="text-xs text-[color:var(--ink-soft)]">Client view</p>
              </div>
            </div>
          </div>
          <nav className="space-y-2 rounded-3xl bg-white/80 p-4 ring-soft">
            {[
              { label: "Dashboard", href: "/client" },
              { label: "Distribution", href: "/distribution" },
              { label: "Transactions", href: "/transactions" },
              { label: "Goals", href: "/goals" },
              { label: "Cash flow", href: "#", disabled: true },
              { label: "Accounts", href: "/accounts" },
              { label: "Investments", href: "#", disabled: true },
              { label: "Categories", href: "/categories" },
              { label: "Recurrings", href: "#", disabled: true },
              { label: "Settings", href: "/settings" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm ${
                  item.disabled
                    ? "cursor-not-allowed text-[color:var(--ink-soft)]/60"
                    : "text-[color:var(--ink-soft)] hover:bg-white/60"
                }`}
              >
                <span>{item.label}</span>
                {item.disabled ? (
                  <span className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                    Soon
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                Dashboard
              </p>
              <h1 className="font-display text-3xl md:text-4xl">
                {clientName}'s money story, summarized.
              </h1>
              <p className="text-sm text-[color:var(--ink-soft)]">
                Month-to-date snapshot · Updated just now
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SignOutButton className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]" />
            </div>
          </header>

        {connectionStatus && connectionStatus.state !== "connected" ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/80 p-4 ring-soft">
            <div>
              <p className="text-sm font-medium">{connectionStatus.title}</p>
              <p className="text-xs text-[color:var(--ink-soft)]">
                {connectionStatus.description}
              </p>
            </div>
            <PlaidLinkButton />
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
          <div className="flex flex-col gap-6">
            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Monthly spending</p>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  Real-time spend vs expected income
                </p>
              </div>
              <Link
                href="/transactions"
                className="text-xs font-semibold text-[color:var(--ocean)]"
              >
                Transactions
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                {budgetRemaining !== null ? (
                  <>
                    <p className="text-3xl font-semibold tracking-tight">
                      {formatCurrency(Math.max(budgetRemaining, 0))} left
                    </p>
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      out of {formatCurrency(monthBudget)} budgeted
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-semibold tracking-tight">
                      {formatCurrency(monthSpend)} spent
                    </p>
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      {monthBudget > 0 && !showBudget
                        ? "Budget coverage partial · Showing spend only"
                        : "Month-to-date total"}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
                <span className="rounded-full bg-white px-3 py-1 ring-soft">
                  Month to date
                </span>
              </div>
            </div>
            <MonthlySpendChart
              values={monthDailySpend ?? []}
              incomeValues={monthDailyIncome ?? []}
              budget={monthBudgetTotal ?? undefined}
              expectedIncome={incomeSummary?.expected ?? undefined}
              daysElapsed={monthDaysElapsed}
            />
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[color:var(--ink-soft)]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[color:var(--ocean)]" />
                <span>Spend</span>
              </div>
              {incomeExpected > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-300" />
                  <span>Actual income</span>
                </div>
              ) : null}
              {incomeExpected > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="h-[2px] w-3 rounded-full bg-amber-300" />
                  <span>Expected income</span>
                </div>
              ) : null}
              {showBudget ? (
                <div className="flex items-center gap-2">
                  <span className="h-[2px] w-3 rounded-full bg-slate-300" />
                  <span>Budget</span>
                </div>
              ) : null}
            </div>
            {budgetRemaining !== null && budgetRemaining < 0 ? (
              <p className="mt-3 text-xs text-rose-600">
                Over budget by {formatCurrency(Math.abs(budgetRemaining))}.
              </p>
            ) : null}
          </div>

            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Transactions snapshot</p>
              <Link
                href="/transactions"
                className="text-xs font-semibold text-[color:var(--ocean)]"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {(recentTransactions ?? []).length === 0 ? (
                <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                  No recent transactions yet.
                </div>
              ) : (
                (recentTransactions ?? []).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 ring-soft"
                  >
                    <div>
                      <p className="text-sm font-medium">{tx.name}</p>
                      <p className="text-xs text-[color:var(--ink-soft)]">
                        {tx.category} · {tx.date}
                      </p>
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        tx.isIncome ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {tx.isIncome ? "+" : "-"}
                      {formatCurrencyDetailed(tx.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Goals</p>
              <Link
                href="/goals"
                className="text-xs font-semibold text-[color:var(--ocean)]"
              >
                Manage goals
              </Link>
            </div>
            <div className="mt-4 space-y-4">
              {goals.length === 0 ? (
                <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                  Add your first goal to start tracking progress.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[color:var(--ink)]">
                        AI goal summary
                      </span>
                      {goalSummary?.status && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            goalSummary.status === "on_track"
                              ? "bg-emerald-100 text-emerald-700"
                              : goalSummary.status === "off_track"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {goalSummary.status.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <p className="mt-2">
                      {goalSummaryLoading
                        ? "Generating your monthly goal summary..."
                        : goalSummary?.summary ??
                          "We’ll summarize your goal progress as soon as more data is available."}
                    </p>
                  </div>
                  {goals.map((goal) => {
                    const progress = Math.min(
                      100,
                      Math.round((goal.current / goal.target) * 100)
                    );
                    return (
                      <div key={goal.id ?? goal.name}>
                        <div className="flex items-center justify-between text-xs">
                          <span>{goal.name}</span>
                          <span className="text-[color:var(--ink-soft)]">
                            {goal.current} / {goal.target}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-[color:var(--ocean)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Budget tuning</p>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  Adjust a flexible category and see payoff timing change.
                </p>
              </div>
              <Link
                href="/categories"
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[color:var(--ink-soft)]"
              >
                Manage budgets
              </Link>
            </div>

            {flexibleBudgets.length > 0 ? (
              <div className="mt-6 rounded-3xl bg-white/80 p-4 ring-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedBudget?.name ?? "Flexible budget"}
                    </p>
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      Current spend {formatCurrency(baselineSpend)}
                    </p>
                  </div>
                  <select
                    value={selectedBudgetName}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSelectedBudgetName(next);
                      const match = flexibleBudgets.find(
                        (item) => item.name === next
                      );
                      if (match) {
                        setSliderValue(match.budget || match.spend || 0);
                      }
                    }}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[color:var(--ink-soft)]"
                  >
                    {flexibleBudgets.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-[color:var(--ink-soft)]">
                    <span>{formatCurrency(sliderMin)}</span>
                    <span>{formatCurrency(sliderValue)}</span>
                    <span>{formatCurrency(Math.round(sliderMax))}</span>
                  </div>
                  <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={10}
                    value={sliderValue}
                    onChange={(event) =>
                      setSliderValue(Number(event.target.value))
                    }
                    className="mt-2 w-full accent-[color:var(--ocean)]"
                  />
                </div>
                <div className="mt-3 text-xs text-[color:var(--ink-soft)]">
                  {debtRemaining <= 0 ? (
                    <span>Add a debt payoff goal to see projections.</span>
                  ) : newPayment <= 0 ? (
                    <span>
                      Lowering this too much removes your debt payoff signal.
                    </span>
                  ) : (
                    <span>
                      With{" "}
                      <strong className="text-[color:var(--ink)]">
                        {formatCurrency(Math.abs(changeAmount))}
                      </strong>{" "}
                      {changeAmount >= 0 ? "freed up" : "added"} monthly, you
                      finish{" "}
                      {monthsDelta > 0 ? (
                        <>
                          about{" "}
                          <strong className="text-[color:var(--ink)]">
                            {monthsDelta}
                          </strong>{" "}
                          months sooner.
                        </>
                      ) : monthsDelta < 0 ? (
                        <>
                          about{" "}
                          <strong className="text-[color:var(--ink)]">
                            {Math.abs(monthsDelta)}
                          </strong>{" "}
                          months later.
                        </>
                      ) : (
                        "at the same pace."
                      )}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                Add flexible budgets to enable payoff tuning.
              </div>
            )}

            {budgetRecommendations && budgetRecommendations.length > 0 ? (
              <div className="mt-5 rounded-2xl bg-[color:var(--ink)] p-4 text-white">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                  Coach projection
                </p>
                <ul className="mt-3 space-y-2 text-xs text-emerald-50/90">
                  {budgetRecommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Monthly income</p>
                <span className="text-xs text-[color:var(--ink-soft)]">
                  Forecast updates as deposits arrive
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold">
                    {formatCurrency(incomeActual)}
                  </p>
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    of {formatCurrency(incomeExpected)} expected
                  </p>
                </div>
                <div className="text-xs text-[color:var(--ink-soft)]">
                  {incomeExpected > 0
                    ? `${formatCurrency(incomeRemaining)} remaining`
                    : "No forecast yet"}
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-[color:var(--ocean)]"
                  style={{ width: `${incomeProgress}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-[color:var(--ink-soft)]">
                {incomeExpected > 0 ? (
                  <span
                    className={
                      incomeVariance >= 0 ? "text-emerald-600" : "text-rose-600"
                    }
                  >
                    {incomeVariance >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(incomeVariance))} vs expected
                  </span>
                ) : (
                  <span>Add a few income deposits to build your forecast.</span>
                )}
              </div>
            </div>

            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Assets & debt</p>
                <Link
                  href="/accounts"
                  className="text-xs font-semibold text-[color:var(--ocean)]"
                >
                  Accounts
                </Link>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/70 p-4 ring-soft">
                  <p className="text-xs text-[color:var(--ink-soft)]">Assets</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatCurrency(assetsTotal ?? 0)}
                  </p>
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    Across {accounts.length} accounts
                  </p>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 ring-soft">
                  <p className="text-xs text-[color:var(--ink-soft)]">Debt</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatCurrency(debtTotal ?? 0)}
                  </p>
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    Includes credit + loans
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Top categories</p>
                <Link
                  href="/categories"
                  className="text-xs font-semibold text-[color:var(--ocean)]"
                >
                  View all
                </Link>
              </div>
              <div className="mt-2 text-xs text-[color:var(--ink-soft)]">
                {categorySummaryLabel ?? "Month-to-date spend by category."}
              </div>
              <div className="mt-4 space-y-4">
                {sortedCategories.length === 0 ? (
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                    No category data yet.
                  </div>
                ) : (
                  sortedCategories.map((item) => {
                    const progress = item.budget
                      ? Math.min(100, (item.spend / item.budget) * 100)
                      : Math.min(100, (item.spend / categorySpendMax) * 100);
                    return (
                      <div key={item.name}>
                        <div className="flex items-center justify-between text-xs">
                          <span>{item.name}</span>
                          <span className="text-[color:var(--ink-soft)]">
                            {formatCurrency(item.spend)}
                            {item.budget
                              ? ` / ${formatCurrency(item.budget)}`
                              : ""}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-emerald-100">
                          <div
                            className="h-2 rounded-full bg-[color:var(--ocean)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        </main>
      </div>

      <InsightsChatWidget />
    </div>
  );
}

function InsightsChatWidget() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-[360px] rounded-[28px] bg-white/85 p-4 shadow-xl ring-soft">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">AI spending insights</p>
              <p className="text-[11px] text-[color:var(--ink-soft)]">
                Ask about your spending
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] text-[color:var(--ink-soft)]"
            >
              Close
            </button>
          </div>
          <div className="h-[440px]">
            <InsightsChatClient variant="widget" />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--ocean)] text-white shadow-lg transition ${
          open ? "hidden" : ""
        }`}
        aria-label="Open insights chat"
      >
        <span className="text-xl">💬</span>
      </button>
    </div>
  );
}

function MonthlySpendChart({
  values,
  incomeValues,
  budget,
  expectedIncome,
  daysElapsed,
}: {
  values: number[];
  incomeValues: number[];
  budget?: number;
  expectedIncome?: number;
  daysElapsed?: number;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const safeValues = values.length > 1 ? values : [0, 0];
  const safeIncomeValues =
    incomeValues.length > 1
      ? incomeValues
      : Array(safeValues.length).fill(0);
  const totalDays = safeValues.length;
  const visibleCount = Math.min(
    Math.max(daysElapsed ?? totalDays, 2),
    totalDays
  );
  const visibleValues = safeValues.slice(0, visibleCount);
  const visibleIncome = safeIncomeValues.slice(0, visibleCount);
  const progressRatio = (visibleCount - 1) / (totalDays - 1);
  const expectedAtDay =
    expectedIncome && expectedIncome > 0
      ? expectedIncome * progressRatio
      : 0;
  const budgetAtDay =
    budget && budget > 0 ? budget * progressRatio : 0;
  const incomeVisibleMax = Math.max(...visibleIncome, 0);
  const maxBase = Math.max(
    ...visibleValues,
    incomeVisibleMax,
    budgetAtDay,
    expectedAtDay,
    expectedIncome ?? 0,
    1
  );
  const max = maxBase * 1.08;
  const points = visibleValues
    .map((value, index) => {
      const x = (index / (totalDays - 1)) * 320;
      const y = 120 - (value / max) * 90;
      return `${x},${y}`;
    })
    .join(" ");

  const lastPoint = points.split(" ").slice(-1)[0] ?? "0,0";
  const [lastX, lastY] = lastPoint.split(",").map(Number);

  const budgetY =
    budgetAtDay > 0 ? 120 - (budgetAtDay / max) * 90 : null;
  const expectedY =
    expectedIncome && expectedIncome > 0
      ? 120 - (expectedIncome / max) * 90
      : null;

  const tickDays = useMemo(() => {
    const ticks: number[] = [];
    for (let day = 7; day < totalDays; day += 7) {
      ticks.push(day);
    }
    return ticks;
  }, [totalDays]);

  const incomePoints =
    incomeVisibleMax > 0
      ? visibleIncome
          .map((value, index) => {
            const x = (index / (totalDays - 1)) * 320;
            const y = 120 - (value / max) * 90;
            return `${x},${y}`;
          })
          .join(" ")
      : null;

  const hoverX =
    hoverIndex !== null ? (hoverIndex / (totalDays - 1)) * 320 : null;
  const hoverValue =
    hoverIndex !== null ? visibleValues[Math.min(hoverIndex, visibleValues.length - 1)] : null;
  const hoverIncome =
    hoverIndex !== null
      ? visibleIncome[Math.min(hoverIndex, visibleIncome.length - 1)]
      : null;
  const hoverExpected = expectedIncome && expectedIncome > 0 ? expectedIncome : null;
  const hoverY =
    hoverValue !== null ? 120 - (hoverValue / max) * 90 : null;
  const tooltipLeft =
    hoverX !== null ? Math.min(92, Math.max(8, (hoverX / 320) * 100)) : 50;

  return (
    <div className="relative mt-6">
      <svg
        ref={svgRef}
        viewBox="0 0 320 140"
        className="h-56 w-full"
        aria-hidden
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          const bounds = svgRef.current?.getBoundingClientRect();
          if (!bounds) return;
          const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
          const ratio = x / bounds.width;
          const idx = Math.round(ratio * (totalDays - 1));
          const clamped = Math.min(Math.max(idx, 0), visibleCount - 1);
          setHoverIndex(clamped);
        }}
      >
        <defs>
          <linearGradient id="spendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--ocean)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--ocean)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="futureFade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0f162a" stopOpacity="0" />
            <stop offset="100%" stopColor="#0f162a" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect x="0" y="24" width="320" height="96" rx="10" fill="rgba(9,13,27,0.45)" />
        <line x1="0" y1="90" x2="320" y2="90" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="0" y1="60" x2="320" y2="60" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        {tickDays.map((day) => {
          const tickX = ((day - 1) / (totalDays - 1)) * 320;
          return (
            <line
              key={`tick-${day}`}
              x1={tickX}
              y1="24"
              x2={tickX}
              y2="120"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          );
        })}
        {budgetY !== null ? (
          <line
            x1="0"
            y1={budgetY}
            x2="320"
            y2={budgetY}
            stroke="#d6dadd"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
        ) : null}
        {expectedY !== null ? (
          <line
            x1="0"
            y1={expectedY}
            x2="320"
            y2={expectedY}
            stroke="#fbbf24"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
        ) : null}
        {incomePoints ? (
          <polyline
            points={incomePoints}
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {lastX < 320 ? (
          <rect
            x={lastX}
            y="24"
            width={320 - lastX}
            height="96"
            fill="url(#futureFade)"
            pointerEvents="none"
          />
        ) : null}
        <polyline
          points={`${points} ${lastX},120 0,120`}
          fill="url(#spendFill)"
          stroke="none"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--ocean)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastX} cy={lastY} r="4" fill="var(--ocean)" />
        {hoverX !== null && hoverY !== null ? (
          <>
            <line
              x1={hoverX}
              y1="24"
              x2={hoverX}
              y2="120"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <circle cx={hoverX} cy={hoverY} r="4" fill="var(--ocean)" />
          </>
        ) : null}
      </svg>
      {hoverX !== null && hoverValue !== null ? (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-2xl border border-black/5 bg-white/95 px-3 py-2 text-[11px] text-[color:var(--ink)] shadow-sm"
          style={{ left: `${tooltipLeft}%` }}
        >
          <div className="font-semibold">Day {hoverIndex! + 1}</div>
          <div className="text-[color:var(--ink-soft)]">
            Spend {formatCurrency(hoverValue)}
          </div>
          {hoverIncome !== null && hoverIncome > 0 ? (
            <div className="text-[color:var(--ink-soft)]">
              Income {formatCurrency(hoverIncome)}
            </div>
          ) : null}
          {hoverExpected !== null ? (
            <div className="text-[color:var(--ink-soft)]">
              Expected {formatCurrency(hoverExpected)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
