"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DebtAccount = {
  id: string;
  name: string;
  institutionName?: string | null;
  mask?: string | null;
  balance: number;
  estimatedPayment?: number | null;
};

type Props = {
  debtAccounts: DebtAccount[];
  hasExistingGoals: boolean;
  liquidCash: number;
};

type GoalKey = "DEBT" | "EMERGENCY" | "SAVINGS";

type GoalDetails = {
  name: string;
  target: string;
  startDate: string;
  endDate: string;
  accountId?: string;
  minPayment?: string;
  complete?: boolean;
  interestRate?: string;
  termMonths?: string;
};

const goalOptions: Array<{
  key: GoalKey;
  type: "DEBT" | "SAVINGS";
  label: string;
  description: string;
  defaultName: string;
}> = [
  {
    key: "DEBT",
    type: "DEBT",
    label: "Pay off debt",
    description: "Focus on a single debt balance and a payoff date.",
    defaultName: "Debt payoff",
  },
  {
    key: "EMERGENCY",
    type: "SAVINGS",
    label: "Build emergency fund",
    description: "Create a safety buffer for unexpected expenses.",
    defaultName: "Emergency fund",
  },
  {
    key: "SAVINGS",
    type: "SAVINGS",
    label: "Grow savings",
    description: "Save toward a specific amount or milestone.",
    defaultName: "Savings goal",
  },
];

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function GoalSetupWizardClient({
  debtAccounts,
  hasExistingGoals,
  liquidCash,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<GoalKey[]>([]);
  const [details, setDetails] = useState<Record<GoalKey, GoalDetails>>({
    DEBT: {
      name: "Debt payoff",
      target: "",
      startDate: todayISO(),
      endDate: "",
      accountId: "manual",
      minPayment: "",
      interestRate: "",
      termMonths: "",
    },
    EMERGENCY: {
      name: "Emergency fund",
      target: "",
      startDate: todayISO(),
      endDate: "",
      complete: false,
    },
    SAVINGS: {
      name: "Savings goal",
      target: "",
      startDate: todayISO(),
      endDate: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(hasExistingGoals);

  useEffect(() => {
    setDetails((prev) => {
      const next = { ...prev };
      selected.forEach((key) => {
        if (!next[key]) {
          const option = goalOptions.find((item) => item.key === key);
          next[key] = {
            name: option?.defaultName ?? "Goal",
            target: "",
            startDate: todayISO(),
            endDate: "",
          };
        }
      });
      return next;
    });
  }, [selected]);

  const rankedOptions = useMemo(
    () => selected.map((key) => goalOptions.find((item) => item.key === key)),
    [selected]
  );

  const toggleGoal = (key: GoalKey) => {
    setSelected((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }
      if (prev.length >= 3) return prev;
      return [...prev, key];
    });
  };

  const moveGoal = (key: GoalKey, direction: -1 | 1) => {
    setSelected((prev) => {
      const index = prev.indexOf(key);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const updateDetails = (key: GoalKey, patch: Partial<GoalDetails>) => {
    setDetails((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const handleDebtAccountChange = (accountId: string) => {
    const account = debtAccounts.find((item) => item.id === accountId);
    updateDetails("DEBT", {
      accountId,
      target: account ? String(Math.round(account.balance)) : "",
      minPayment:
        account?.estimatedPayment && account.estimatedPayment > 0
          ? String(Math.round(account.estimatedPayment))
          : details.DEBT.minPayment ?? "",
    });
  };

  const validateStepTwo = () => {
    if (selected.length === 0) {
      return "Pick at least one goal to continue.";
    }
    for (const key of selected) {
      const info = details[key];
      if (!info?.name?.trim()) return "Add a goal name for each goal.";
      if (!info?.target || Number(info.target) <= 0) {
        return "Add a target amount for each goal.";
      }
      if (!info?.endDate && !(key === "EMERGENCY" && info.complete)) {
        return "Add a target date for each goal.";
      }
      if (key === "DEBT" && !info.minPayment) {
        return "Add a minimum payment for the debt goal.";
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    const issue = validateStepTwo();
    if (issue) {
      setError(issue);
      return;
    }
    setSaving(true);
    try {
      if (replaceExisting) {
        await fetch("/api/goals", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reset: true }),
        });
      }
      for (let index = 0; index < selected.length; index += 1) {
        const key = selected[index];
        const option = goalOptions.find((item) => item.key === key);
        const info = details[key];
        if (!option || !info) continue;
        const payload = {
          name: info.name.trim(),
          type: option.type,
          cadence: "MONTHLY",
          target: Number(info.target),
          startDate: info.startDate || null,
          endDate:
            option.key === "EMERGENCY" && info.complete
              ? todayISO()
              : info.endDate || null,
          priority: index + 1,
          accountId:
            key === "DEBT" && info.accountId && info.accountId !== "manual"
              ? info.accountId
              : null,
          minPayment:
            key === "DEBT" && info.minPayment
              ? Number(info.minPayment)
              : null,
          interestRate:
            key === "DEBT" && info.interestRate
              ? Number(info.interestRate)
              : null,
          termMonths:
            key === "DEBT" && info.termMonths
              ? Number(info.termMonths)
              : null,
          status:
            option.key === "EMERGENCY" && info.complete
              ? "COMPLETED"
              : "ACTIVE",
        };
        await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      router.push("/goals");
    } catch (err) {
      setError("Unable to save goals. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
            Goal setup
          </p>
          <h1 className="font-display text-3xl md:text-4xl">
            Set your top priorities
          </h1>
          <p className="text-sm text-[color:var(--ink-soft)]">
            Three steps. We only ask what we cannot infer from your data.
          </p>
        </div>
        <div className="text-xs text-[color:var(--ink-soft)]">
          Step {step} of 3
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-8">
          <p className="text-sm font-semibold">
            Choose up to 3 goals for the next 12 months
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {goalOptions.map((option) => {
              const isSelected = selected.includes(option.key);
              const rank = selected.indexOf(option.key) + 1;
              return (
                <button
                  key={option.key}
                  onClick={() => toggleGoal(option.key)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-[color:var(--ocean)] bg-emerald-50/70"
                      : "border-black/10 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{option.label}</p>
                    {isSelected ? (
                      <span className="rounded-full bg-[color:var(--ocean)] px-2 py-0.5 text-[10px] font-semibold text-white">
                        #{rank}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>

          {selected.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-black/10 bg-white/70 p-4">
              <p className="text-xs font-semibold text-[color:var(--ink-soft)]">
                Rank your goals
              </p>
              <div className="mt-3 space-y-2">
                {selected.map((key, index) => {
                  const option = goalOptions.find((item) => item.key === key);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm"
                    >
                      <span>
                        {index + 1}. {option?.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => moveGoal(key, -1)}
                          className="rounded-full border border-black/10 px-2 py-1 text-xs text-[color:var(--ink-soft)]"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveGoal(key, 1)}
                          className="rounded-full border border-black/10 px-2 py-1 text-xs text-[color:var(--ink-soft)]"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={() => setStep(2)}
              disabled={selected.length === 0}
              className="rounded-full bg-[color:var(--ink)] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-8 space-y-6">
          {rankedOptions.map((option) => {
            if (!option) return null;
            const info = details[option.key];
            if (!info) return null;
            return (
              <div
                key={option.key}
                className="rounded-2xl border border-black/10 bg-white/70 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
                      Priority #{selected.indexOf(option.key) + 1}
                    </p>
                    <h3 className="text-lg font-semibold">{option.label}</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                      Goal name
                    </label>
                    <input
                      value={info.name}
                      onChange={(event) =>
                        updateDetails(option.key, { name: event.target.value })
                      }
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                      Target amount
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={info.target}
                      onChange={(event) =>
                        updateDetails(option.key, { target: event.target.value })
                      }
                      disabled={
                        option.key === "DEBT" &&
                        Boolean(info.accountId) &&
                        info.accountId !== "manual"
                      }
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {option.key === "EMERGENCY" &&
                Number(info.target) > 0 &&
                Number(info.target) <= liquidCash ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    You already have {formatCurrency(liquidCash)} in liquid cash.
                    Mark this goal as completed, or raise the target to keep it
                    active.
                    <label className="mt-3 flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(info.complete)}
                        onChange={(event) =>
                          updateDetails(option.key, {
                            complete: event.target.checked,
                          })
                        }
                      />
                      Mark this goal as completed.
                    </label>
                  </div>
                ) : null}

                {option.key === "DEBT" ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                        Debt account
                      </label>
                      <select
                        value={info.accountId ?? "manual"}
                        onChange={(event) =>
                          handleDebtAccountChange(event.target.value)
                        }
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                      >
                        <option value="manual">Manual debt amount</option>
                        {debtAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {`${account.institutionName ?? ""} ${
                              account.name
                            }${account.mask ? ` •••${account.mask}` : ""}`.trim()}{" "}
                            · {formatCurrency(account.balance)}
                          </option>
                        ))}
                      </select>
                      {info.accountId && info.accountId !== "manual" ? (
                        <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                          Target uses current balance from this account.
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                        Minimum monthly payment
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={info.minPayment ?? ""}
                        onChange={(event) =>
                          updateDetails(option.key, {
                            minPayment: event.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                      />
                      {info.accountId &&
                      info.accountId !== "manual" &&
                      debtAccounts.find((item) => item.id === info.accountId)
                        ?.estimatedPayment ? (
                        <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                          Estimated from transactions. Adjust if needed.
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                        Interest rate (APR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={info.interestRate ?? ""}
                        onChange={(event) =>
                          updateDetails(option.key, {
                            interestRate: event.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                        placeholder="18.9"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                        Remaining term (months)
                      </label>
                      <input
                        type="number"
                        min={1}
                        step="1"
                        value={info.termMonths ?? ""}
                        onChange={(event) =>
                          updateDetails(option.key, {
                            termMonths: event.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                        placeholder="36"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                      Start date
                    </label>
                    <input
                      type="date"
                      value={info.startDate}
                      onChange={(event) =>
                        updateDetails(option.key, {
                          startDate: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                      Target date
                    </label>
                    <input
                      type="date"
                      value={info.endDate}
                      onChange={(event) =>
                        updateDetails(option.key, {
                          endDate: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {error ? (
            <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
            >
              Back
            </button>
            <button
              onClick={() => {
                const issue = validateStepTwo();
                if (issue) {
                  setError(issue);
                  return;
                }
                setError(null);
                setStep(3);
              }}
              className="rounded-full bg-[color:var(--ink)] px-6 py-3 text-sm font-semibold text-white"
            >
              Review goals
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <p className="text-sm font-semibold">Review your priorities</p>
            <div className="mt-4 space-y-3">
              {rankedOptions.map((option, index) => {
                if (!option) return null;
                const info = details[option.key];
                return (
                  <div
                    key={option.key}
                    className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm"
                  >
                    <p className="font-semibold">
                      {index + 1}. {info?.name ?? option.label}
                    </p>
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      Target {formatCurrency(Number(info?.target ?? 0))} by{" "}
                      {info?.endDate}
                    </p>
                    {option.key === "DEBT" && info?.minPayment ? (
                      <p className="text-xs text-[color:var(--ink-soft)]">
                        Minimum payment {formatCurrency(Number(info.minPayment))}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {hasExistingGoals ? (
            <label className="flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(event) => setReplaceExisting(event.target.checked)}
              />
              Replace existing goals with this setup.
            </label>
          ) : null}

          {error ? (
            <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full bg-[color:var(--ink)] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
            >
              {saving ? "Saving..." : "Create goals"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
