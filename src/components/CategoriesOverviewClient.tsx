"use client";

import { useMemo, useState } from "react";
import { categoryColorPalette } from "@/lib/categoryColors";

type Summary = {
  mode: "budget" | "compare";
  spend: number;
  budget: number;
  projected: number;
  prevSpend: number;
  changePct: number;
};

type CategoryRow = {
  name: string;
  color: string;
  spend: number;
  prevSpend: number;
  budget: number | null;
  essential: boolean;
  projected: number;
  remaining: number | null;
  status: "ok" | "risk" | "over" | "neutral";
};

type GroupRow = {
  id: string;
  name: string;
  spend: number;
  budget: number | null;
  unassignedBudget: number | null;
  status: "ok" | "risk" | "over" | "neutral";
  categories: CategoryRow[];
};

type TransactionRow = {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
};

type Props = {
  summary: Summary;
  categories: CategoryRow[];
  groups: GroupRow[];
  transactions: TransactionRow[];
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

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

const formatMonthShort = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short" });

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function CategoriesOverviewClient({
  summary,
  categories,
  groups,
  transactions,
}: Props) {
  const [rows, setRows] = useState<CategoryRow[]>(categories);
  const [selectedName, setSelectedName] = useState<string>(
    categories[0]?.name ?? "Uncategorized"
  );
  const [savingName, setSavingName] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newEssential, setNewEssential] = useState(false);
  const [newColor, setNewColor] = useState<string>(categoryColorPalette[0]);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [essentialDraft, setEssentialDraft] = useState(false);
  const [colorDraft, setColorDraft] = useState<string>(categoryColorPalette[0]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.name === selectedName) ?? rows[0],
    [rows, selectedName]
  );

  const categorySpendMax = useMemo(() => {
    const values = rows.map((row) => row.budget ?? row.spend);
    return Math.max(...values, 1);
  }, [rows]);

  const rowsByName = useMemo(
    () => new Map(rows.map((row) => [row.name, row])),
    [rows]
  );

  const sortedGroups = useMemo(
    () =>
      [...groups]
        .map((group) => {
          const categories = group.categories.map(
            (item) => rowsByName.get(item.name) ?? item
          );
          const spend = categories.reduce((total, item) => total + item.spend, 0);
          const budgetSum = categories.reduce(
            (total, item) => total + (item.budget ?? 0),
            0
          );
          const budget =
            budgetSum + (group.unassignedBudget ?? 0) > 0
              ? budgetSum + (group.unassignedBudget ?? 0)
              : null;
          return {
            ...group,
            spend,
            budget,
            categories,
          };
        })
        .sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === "over") return -1;
          if (b.status === "over") return 1;
          if (a.status === "risk") return -1;
          if (b.status === "risk") return 1;
        }
        return b.spend - a.spend;
        }),
    [groups, rowsByName]
  );

  const groupedCategoryNames = useMemo(() => {
    const set = new Set<string>();
    sortedGroups.forEach((group) => {
      group.categories.forEach((item) => set.add(item.name));
    });
    return set;
  }, [sortedGroups]);

  const ungroupedCategories = useMemo(
    () => rows.filter((row) => !groupedCategoryNames.has(row.name)),
    [rows, groupedCategoryNames]
  );

  const handleSave = async (row: CategoryRow) => {
    setSavingName(row.name);
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: row.name,
        color: row.color,
        essential: row.essential,
        monthlyBudget: row.budget,
      }),
    });
    setSavingName(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const budget = newBudget ? Number(newBudget) : null;
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        color: newColor,
        essential: newEssential,
        monthlyBudget: budget,
      }),
    });
    const newRow: CategoryRow = {
      name: newName.trim(),
      color: newColor,
      spend: 0,
      prevSpend: 0,
      budget: budget,
      essential: newEssential,
      projected: 0,
      remaining: budget ? budget : null,
      status: "neutral",
    };
    setRows((prev) => [newRow, ...prev]);
    setSelectedName(newRow.name);
    setNewName("");
    setNewBudget("");
    setNewEssential(false);
    setNewColor(categoryColorPalette[0]);
    setShowAdd(false);
  };

  const filteredTransactions = useMemo(() => {
    if (!selectedRow) return [];
    return transactions
      .filter((tx) => tx.category === selectedRow.name && tx.amount > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [selectedRow, transactions]);

  const monthlyTotals = useMemo(() => {
    const now = new Date();
    const months: { label: string; key: string }[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      months.push({ label: formatMonthShort(date), key });
    }
    const totals = new Map<string, number>();
    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      totals.set(key, (totals.get(key) ?? 0) + tx.amount);
    });
    return months.map((item) => ({
      label: item.label,
      value: totals.get(item.key) ?? 0,
    }));
  }, [filteredTransactions]);

  const yearlyMetrics = useMemo(() => {
    const byYear = new Map<number, { total: number; months: Set<string> }>();
    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      const year = date.getFullYear();
      const monthKey = `${year}-${date.getMonth()}`;
      if (!byYear.has(year)) {
        byYear.set(year, { total: 0, months: new Set() });
      }
      const entry = byYear.get(year);
      if (!entry) return;
      entry.total += tx.amount;
      entry.months.add(monthKey);
    });
    const years = Array.from(byYear.keys()).sort((a, b) => b - a);
    return years.slice(0, 3).map((year) => {
      const entry = byYear.get(year);
      const monthsCount = entry?.months.size ?? 1;
      return {
        year,
        total: entry?.total ?? 0,
        avgMonthly: (entry?.total ?? 0) / Math.max(monthsCount, 1),
      };
    });
  }, [filteredTransactions]);

  const groupedTransactions = useMemo(() => {
    const groupsMap = new Map<string, TransactionRow[]>();
    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      const label = formatMonthLabel(date);
      const list = groupsMap.get(label) ?? [];
      list.push(tx);
      groupsMap.set(label, list);
    });
    return Array.from(groupsMap.entries());
  }, [filteredTransactions]);

  const handleSelect = (name: string) => {
    setSelectedName(name);
    setEditingBudget(false);
    const row = rows.find((item) => item.name === name);
    setBudgetDraft(row?.budget ? String(row.budget) : "");
    setEssentialDraft(Boolean(row?.essential));
    setColorDraft(row?.color ?? categoryColorPalette[0]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.15fr]">
      <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Categories</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              Rebalance
            </button>
            <button
              onClick={() => setShowAdd((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-lg text-[color:var(--ink-soft)]"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-black/5 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">
                {formatCurrency(summary.spend)}
              </p>
              <p className="text-xs text-[color:var(--ink-soft)]">
                spent in {formatMonthShort(new Date())}
              </p>
            </div>
            <DonutChart spend={summary.spend} budget={summary.budget} />
            <div className="text-right">
              <p className="text-sm font-semibold">
                {formatCurrency(summary.budget)}
              </p>
              <p className="text-xs text-[color:var(--ink-soft)]">
                total budget
              </p>
            </div>
          </div>
        </div>

        {showAdd ? (
          <div className="mt-4 grid gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="New category"
              className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={newBudget}
                onChange={(event) => setNewBudget(event.target.value)}
                placeholder="Monthly budget"
                className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs text-[color:var(--ink-soft)]">
                <input
                  type="checkbox"
                  checked={newEssential}
                  onChange={(event) => setNewEssential(event.target.checked)}
                />
                Essential
              </label>
            </div>
            <ColorPicker
              value={newColor}
              onChange={setNewColor}
              label="Category color"
            />
            <button
              onClick={handleCreate}
              className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-xs font-semibold text-white"
            >
              Add category
            </button>
          </div>
        ) : null}

        <div className="mt-6 text-xs font-semibold text-[color:var(--ink-soft)]">
          Regular Categories
        </div>
        <div className="mt-3 grid grid-cols-[1.4fr_0.7fr_0.7fr] gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
          <span>Category</span>
          <span>Spent</span>
          <span>Budget</span>
        </div>

        <div className="mt-3 space-y-3">
          {sortedGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--ink)]">
                <span>{group.name}</span>
                <span className="text-[color:var(--ink-soft)]">
                  {formatCurrency(group.spend)}
                  {group.budget ? ` / ${formatCurrency(group.budget)}` : ""}
                </span>
              </div>
              <div className="space-y-2">
                {group.categories.map((row) => (
                  <CategoryRow
                    key={`${group.id}-${row.name}`}
                    row={row}
                    max={categorySpendMax}
                    selected={row.name === selectedName}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          ))}
          {ungroupedCategories.length > 0 ? (
            <div className="space-y-2">
              {sortedGroups.length > 0 ? (
                <div className="text-xs font-semibold text-[color:var(--ink)]">
                  Other
                </div>
              ) : null}
              {ungroupedCategories.map((row) => (
                <CategoryRow
                  key={row.name}
                  row={row}
                  max={categorySpendMax}
                  selected={row.name === selectedName}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-[color:var(--ink)] p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
              Category
            </p>
            <div className="mt-1 flex items-center gap-3">
              {selectedRow ? (
                <span
                  className="h-3 w-3 rounded-full ring-2 ring-white/25"
                  style={{ backgroundColor: selectedRow.color }}
                />
              ) : null}
              <h2 className="text-2xl font-semibold">
                {selectedRow?.name ?? "Select a category"}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingBudget((prev) => !prev);
                setBudgetDraft(
                  selectedRow?.budget ? String(selectedRow.budget) : ""
                );
                setEssentialDraft(Boolean(selectedRow?.essential));
                setColorDraft(selectedRow?.color ?? categoryColorPalette[0]);
              }}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70"
            >
              Edit budget
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-lg text-white/70">
              …
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs text-white/70">
              Spent in {formatMonthShort(new Date())}
            </p>
            <p className="text-2xl font-semibold">
              {formatCurrency(selectedRow?.spend ?? 0)}
            </p>
            {selectedRow?.budget ? (
              <p className="text-xs text-white/70">
                {formatCurrency(
                  Math.max((selectedRow?.budget ?? 0) - (selectedRow?.spend ?? 0), 0)
                )}{" "}
                left
              </p>
            ) : (
              <p className="text-xs text-white/70">
                Set a budget to track pacing.
              </p>
            )}
          </div>
        </div>

        {editingBudget && selectedRow ? (
          <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={budgetDraft}
                onChange={(event) => setBudgetDraft(event.target.value)}
                placeholder="Monthly budget"
                className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
              />
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={essentialDraft}
                  onChange={(event) => setEssentialDraft(event.target.checked)}
                />
                Essential
              </label>
            </div>
            <ColorPicker
              value={colorDraft}
              onChange={setColorDraft}
              label="Category color"
              dark
            />
            <button
              onClick={async () => {
                const updated = rows.map((row) =>
                  row.name === selectedRow.name
                    ? {
                        ...row,
                        color: colorDraft,
                        budget: budgetDraft ? Number(budgetDraft) : null,
                        essential: essentialDraft,
                      }
                    : row
                );
                setRows(updated);
                await handleSave({
                  ...selectedRow,
                  color: colorDraft,
                  budget: budgetDraft ? Number(budgetDraft) : null,
                  essential: essentialDraft,
                });
                setEditingBudget(false);
              }}
              className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-xs font-semibold text-white"
            >
              {savingName === selectedRow.name ? "Saving..." : "Save changes"}
            </button>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-4">
          <CategoryBarChart
            values={monthlyTotals}
            color={selectedRow?.color ?? "#f43f5e"}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Key metrics</span>
            <div className="flex items-center gap-6 text-xs text-white/70">
              <span>Spent per year</span>
              <span>Avg monthly spend</span>
            </div>
          </div>
          <div className="mt-3 divide-y divide-white/10 text-sm">
            {yearlyMetrics.length === 0 ? (
              <div className="py-3 text-xs text-white/70">
                No history yet.
              </div>
            ) : (
              yearlyMetrics.map((item) => (
                <div
                  key={item.year}
                  className="grid items-center gap-4 py-3 sm:grid-cols-[1fr_1fr_1fr]"
                >
                  <span className="text-white/70">
                    {item.year}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {formatCurrencyDetailed(item.total)}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {formatCurrencyDetailed(item.avgMonthly)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {groupedTransactions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs text-white/70">
              No transactions yet this month.
            </div>
          ) : (
            groupedTransactions.map(([label, items]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-white/70">
                  {label}
                </p>
                <div className="mt-2 space-y-2">
                  {items.slice(0, 8).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="text-sm font-medium">{tx.name}</p>
                        <p className="text-xs text-white/70">
                          {formatDayLabel(new Date(tx.date))}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-white">
                        -{formatCurrencyDetailed(Math.abs(tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
  label,
  dark = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  dark?: boolean;
}) {
  return (
    <div>
      <p className={`mb-2 text-[10px] uppercase tracking-[0.2em] ${dark ? "text-white/70" : "text-[color:var(--ink-soft)]"}`}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {categoryColorPalette.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`h-6 w-6 rounded-full ring-offset-2 transition ${
              dark ? "ring-offset-[color:var(--ink)]" : "ring-offset-white"
            } ${
              value === color
                ? dark
                  ? "ring-2 ring-white/90"
                  : "ring-2 ring-[color:var(--ocean)]"
                : "ring-1 ring-black/10"
            }`}
            style={{ backgroundColor: color }}
            aria-label={`Select ${color} color`}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({
  row,
  max,
  selected,
  onSelect,
}: {
  row: CategoryRow;
  max: number;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  const progress = row.budget
    ? Math.min(100, (row.spend / row.budget) * 100)
    : Math.min(100, (row.spend / max) * 100);
  return (
    <button
      onClick={() => onSelect(row.name)}
      className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
        selected
          ? ""
          : "border-black/5 bg-white"
      }`}
      style={
        selected
          ? {
              borderColor: row.color,
              backgroundColor: `${row.color}14`,
            }
          : undefined
      }
    >
      <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr] items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: row.color }}
          />
          <span>{row.name}</span>
        </div>
        <span className="text-xs font-semibold">{formatCurrency(row.spend)}</span>
        <span className="text-xs text-[color:var(--ink-soft)]">
          {row.budget ? formatCurrency(row.budget) : "--"}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full"
          style={{ width: `${progress}%`, backgroundColor: row.color }}
        />
      </div>
    </button>
  );
}

function DonutChart({ spend, budget }: { spend: number; budget: number }) {
  const radius = 22;
  const stroke = 6;
  const normalizedBudget = budget > 0 ? budget : spend;
  const progress = normalizedBudget > 0 ? Math.min(1, spend / normalizedBudget) : 0;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle
        cx="32"
        cy="32"
        r={radius}
        stroke="#e5e7eb"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx="32"
        cy="32"
        r={radius}
        stroke="#f97316"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
}

function CategoryBarChart({
  values,
  color,
}: {
  values: { label: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...values.map((item) => item.value), 1);
  return (
    <div>
      <div className="flex items-end gap-2">
        {values.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1">
            <div
              className="w-3 rounded-full"
              style={{ backgroundColor: color, height: `${Math.max(6, (item.value / max) * 90)}px` }}
            />
            <span className="text-[10px] text-white/70">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
