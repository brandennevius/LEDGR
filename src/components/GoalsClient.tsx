"use client";

import { useState } from "react";
import Link from "next/link";

type Goal = {
  id: string;
  name: string;
  type: string;
  cadence: string;
  target: number;
  current: number;
  category?: string | null;
  accountId?: string | null;
  minPayment?: number | null;
  interestRate?: number | null;
  termMonths?: number | null;
  status?: string | null;
  completedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

type Account = {
  id: string;
  name: string;
  type: string;
  subtype?: string | null;
  mask?: string | null;
  institutionName?: string | null;
  currentBalance?: number | null;
  availableBalance?: number | null;
};

type Props = {
  initialGoals: Goal[];
  accounts: Account[];
};

const goalTypeOptions = [
  { value: "SAVINGS", label: "Savings target" },
  { value: "SPEND_LIMIT", label: "Spending limit" },
  { value: "INCOME_TARGET", label: "Income target" },
  { value: "DEBT", label: "Debt payoff" },
  { value: "BUFFER_DAYS", label: "Buffer days" },
];

const cadenceOptions = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Biweekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Custom" },
];

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatGoalValue = (goal: Goal, value: number) => {
  if (goal.type === "BUFFER_DAYS") {
    return `${value.toFixed(1)} days`;
  }
  return formatCurrency(value);
};

export default function GoalsClient({ initialGoals, accounts }: Props) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals ?? []);
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [insightLoading, setInsightLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [insightError, setInsightError] = useState<Record<string, string>>({});
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editMinPayment, setEditMinPayment] = useState("");
  const [editInterestRate, setEditInterestRate] = useState("");
  const [editTermMonths, setEditTermMonths] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "COMPLETED">("ACTIVE");

  const refreshGoals = async () => {
    const response = await fetch("/api/goals");
    if (!response.ok) return;
    const data = (await response.json()) as { goals: Goal[] };
    setGoals(data.goals ?? []);
  };

  const deleteGoal = async (goalId: string) => {
    const confirmed = window.confirm("Delete this goal? This cannot be undone.");
    if (!confirmed) return;
    await fetch("/api/goals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId }),
    });
    await refreshGoals();
  };

  const startEdit = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setEditName(goal.name);
    setEditTarget(String(goal.target));
    setEditEndDate(goal.endDate ? goal.endDate.slice(0, 10) : "");
    setEditMinPayment(goal.minPayment ? String(goal.minPayment) : "");
    setEditInterestRate(goal.interestRate ? String(goal.interestRate) : "");
    setEditTermMonths(goal.termMonths ? String(goal.termMonths) : "");
    setEditStatus((goal.status as "ACTIVE" | "COMPLETED") ?? "ACTIVE");
  };

  const cancelEdit = () => {
    setEditingGoalId(null);
  };

  const saveEdit = async () => {
    if (!editingGoalId) return;
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goalId: editingGoalId,
        name: editName,
        target: Number(editTarget),
        endDate: editEndDate || null,
        minPayment: editMinPayment ? Number(editMinPayment) : null,
        interestRate: editInterestRate ? Number(editInterestRate) : null,
        termMonths: editTermMonths ? Number(editTermMonths) : null,
        status: editStatus,
      }),
    });
    setEditingGoalId(null);
    await refreshGoals();
  };

  const fetchInsight = async (goalId: string) => {
    setInsightError((prev) => ({ ...prev, [goalId]: "" }));
    setInsightLoading((prev) => ({ ...prev, [goalId]: true }));
    const response = await fetch("/api/goals/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setInsightError((prev) => ({
        ...prev,
        [goalId]: data?.error ?? "Unable to generate insights.",
      }));
      setInsightLoading((prev) => ({ ...prev, [goalId]: false }));
      return;
    }
    const data = (await response.json()) as { insight?: string };
    setInsights((prev) => ({
      ...prev,
      [goalId]: data.insight ?? "No insights returned.",
    }));
    setInsightLoading((prev) => ({ ...prev, [goalId]: false }));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[32px] bg-white/85 p-6 ring-soft">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Your goals
            </p>
            <h2 className="font-display text-2xl">Active goals</h2>
          </div>
          <button
            type="button"
            onClick={refreshGoals}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs text-[color:var(--ink-soft)]"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {goals.filter((goal) => goal.status !== "COMPLETED").length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-white/60 px-4 py-6 text-sm text-[color:var(--ink-soft)]">
              No goals yet. Start the guided setup to choose your top priorities.
            </div>
          ) : (
            goals
              .filter((goal) => goal.status !== "COMPLETED")
              .map((goal) => {
                const progressRaw =
                  goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
                const progress = Math.min(100, Math.max(0, progressRaw));
                const overLimit =
                  goal.type === "SPEND_LIMIT" && progressRaw > 100;
                return (
                  <div
                    key={goal.id}
                    className="rounded-3xl bg-white/80 p-4 ring-soft"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-[color:var(--ink)]">
                          {goal.name}
                        </p>
                        <p className="text-xs text-[color:var(--ink-soft)]">
                          {goalTypeOptions.find(
                            (option) => option.value === goal.type
                          )?.label ?? goal.type}{" "}
                          ·{" "}
                          {cadenceOptions.find(
                            (option) => option.value === goal.cadence
                          )?.label ?? goal.cadence}
                          {goal.category ? ` · ${goal.category}` : ""}
                          {goal.accountId
                            ? ` · ${
                                accounts.find(
                                  (account) => account.id === goal.accountId
                                )?.name ?? "Linked account"
                              }`
                            : ""}
                        {goal.type === "DEBT" && goal.minPayment
                          ? ` · Min ${formatCurrency(goal.minPayment)}`
                          : ""}
                          {goal.type === "DEBT" && goal.interestRate
                            ? ` · ${goal.interestRate}% APR`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[color:var(--ink-soft)]">
                          Current
                        </p>
                        <p className="text-sm font-semibold">
                          {formatGoalValue(goal, goal.current)} /{" "}
                          {formatGoalValue(goal, goal.target)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(goal)}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[color:var(--ink-soft)]"
                      >
                        Edit goal
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGoal(goal.id)}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-rose-600"
                      >
                        Delete goal
                      </button>
                    </div>

                    {editingGoalId === goal.id ? (
                      <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs text-[color:var(--ink-soft)]">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.2em]">
                              Goal name
                            </label>
                            <input
                              value={editName}
                              onChange={(event) =>
                                setEditName(event.target.value)
                              }
                              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.2em]">
                              Target amount
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={editTarget}
                              onChange={(event) =>
                                setEditTarget(event.target.value)
                              }
                              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.2em]">
                              Target date
                            </label>
                            <input
                              type="date"
                              value={editEndDate}
                              onChange={(event) =>
                                setEditEndDate(event.target.value)
                              }
                              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          {goal.type === "DEBT" ? (
                            <div>
                              <label className="text-[10px] uppercase tracking-[0.2em]">
                                Min payment
                              </label>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={editMinPayment}
                                onChange={(event) =>
                                  setEditMinPayment(event.target.value)
                                }
                                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                          ) : null}
                          {goal.type === "DEBT" ? (
                            <div>
                              <label className="text-[10px] uppercase tracking-[0.2em]">
                                Interest rate (APR)
                              </label>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={editInterestRate}
                                onChange={(event) =>
                                  setEditInterestRate(event.target.value)
                                }
                                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                          ) : null}
                          {goal.type === "DEBT" ? (
                            <div>
                              <label className="text-[10px] uppercase tracking-[0.2em]">
                                Term (months)
                              </label>
                              <input
                                type="number"
                                min={1}
                                step="1"
                                value={editTermMonths}
                                onChange={(event) =>
                                  setEditTermMonths(event.target.value)
                                }
                                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={editStatus === "COMPLETED"}
                              onChange={(event) =>
                                setEditStatus(
                                  event.target.checked ? "COMPLETED" : "ACTIVE"
                                )
                              }
                            />
                            Mark as completed
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[color:var(--ink-soft)]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="rounded-full bg-[color:var(--ink)] px-3 py-1 text-[10px] font-semibold text-white"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 h-2 rounded-full bg-emerald-100">
                      <div
                        className={`h-2 rounded-full ${
                          overLimit ? "bg-amber-400" : "bg-[color:var(--ocean)]"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                      {overLimit
                        ? "Over limit. Review your spending and adjust the plan."
                        : "On track this cycle."}
                    </p>
                    {goal.type === "DEBT" ? (
                      <div className="mt-4 space-y-3">
                        <button
                          type="button"
                          onClick={() => fetchInsight(goal.id)}
                          className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[color:var(--ink-soft)]"
                          disabled={insightLoading[goal.id]}
                        >
                          {insightLoading[goal.id]
                            ? "Analyzing..."
                            : "Generate payoff plan"}
                        </button>
                        {insightError[goal.id] ? (
                          <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            {insightError[goal.id]}
                          </p>
                        ) : null}
                        {insights[goal.id] ? (
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-[color:var(--ink-soft)] whitespace-pre-wrap">
                            {insights[goal.id]}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
          )}
        </div>
      </section>

      <section className="rounded-[32px] bg-white/85 p-6 ring-soft">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
          Goal setup
        </p>
        <h2 className="mt-2 font-display text-2xl">Pick your top 3 goals</h2>
        <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
          Quick guided setup. We will ask only what we cannot infer from your
          accounts.
        </p>
        <div className="mt-6 space-y-3">
          <Link
            href="/goals/setup"
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--ink)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
          >
            Start goal setup
          </Link>
          {goals.length > 0 ? (
            <p className="text-xs text-[color:var(--ink-soft)]">
              Running setup again will update your priorities.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[32px] bg-white/85 p-6 ring-soft">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
          Completed goals
        </p>
        <h2 className="mt-2 font-display text-2xl">You already finished these</h2>
        <div className="mt-6 space-y-3">
          {goals.filter((goal) => goal.status === "COMPLETED").length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-white/60 px-4 py-6 text-sm text-[color:var(--ink-soft)]">
              No completed goals yet.
            </div>
          ) : (
            goals
              .filter((goal) => goal.status === "COMPLETED")
              .map((goal) => (
                <div
                  key={goal.id}
                  className="rounded-3xl bg-white/80 p-4 ring-soft"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">
                        {goal.name}
                      </p>
                      <p className="text-xs text-[color:var(--ink-soft)]">
                        {goalTypeOptions.find((option) => option.value === goal.type)
                          ?.label ?? goal.type}{" "}
                        · Completed{" "}
                        {goal.completedAt
                          ? new Date(goal.completedAt).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[color:var(--ink-soft)]">
                        Target
                      </p>
                      <p className="text-sm font-semibold">
                        {formatGoalValue(goal, goal.target)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(goal)}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[color:var(--ink-soft)]"
                    >
                      Edit goal
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGoal(goal.id)}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-rose-600"
                    >
                      Delete goal
                    </button>
                  </div>
                  {editingGoalId === goal.id ? (
                    <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs text-[color:var(--ink-soft)]">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-[10px] uppercase tracking-[0.2em]">
                            Goal name
                          </label>
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-[0.2em]">
                            Target amount
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={editTarget}
                            onChange={(event) =>
                              setEditTarget(event.target.value)
                            }
                            className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-[0.2em]">
                            Target date
                          </label>
                          <input
                            type="date"
                            value={editEndDate}
                            onChange={(event) =>
                              setEditEndDate(event.target.value)
                            }
                            className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editStatus === "COMPLETED"}
                            onChange={(event) =>
                              setEditStatus(
                                event.target.checked ? "COMPLETED" : "ACTIVE"
                              )
                            }
                          />
                          Mark as completed
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[color:var(--ink-soft)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="rounded-full bg-[color:var(--ink)] px-3 py-1 text-[10px] font-semibold text-white"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}
