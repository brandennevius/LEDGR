"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

type TransactionRow = {
  id: string;
  name: string;
  category: string;
  amount: number;
  isIncome: boolean;
  needsReview?: boolean;
  source?: string;
  hasSplits?: boolean;
  date: string;
};

type SplitRow = {
  id?: string;
  category: string;
  amount: number;
  note?: string | null;
};

type TransactionDetail = {
  id: string;
  name: string;
  amount: number;
  category: string;
  transactionType?: "INCOME" | "INTERNAL_TRANSFER" | "REGULAR";
  date: string;
  needsReview?: boolean;
  hasSplits?: boolean;
  splits?: SplitRow[];
  account?: {
    name?: string;
    institutionName?: string;
    mask?: string;
    type?: string;
  };
};

const dayOptions = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export default function TransactionsPageClient() {
  const [days, setDays] = useState<number>(30);
  const [category, setCategory] = useState<string>("All");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [categorizing, setCategorizing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [transactionTypeInput, setTransactionTypeInput] = useState<
    "INCOME" | "INTERNAL_TRANSFER" | "REGULAR"
  >("REGULAR");
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [applyToCategory, setApplyToCategory] = useState(false);
  const [createRule, setCreateRule] = useState(false);
  const [ruleMatchType, setRuleMatchType] = useState<"EXACT" | "PARTIAL">(
    "EXACT"
  );
  const [ruleMatchValue, setRuleMatchValue] = useState("");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [splitSaving, setSplitSaving] = useState(false);

  const categoryOptions = useMemo(
    () => ["All", ...categoryList],
    [categoryList]
  );

  const fetchRows = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("days", String(days));
    if (category !== "All") params.set("category", category);
    if (needsReviewOnly) params.set("needsReview", "true");
    const response = await fetch(`/api/transactions?${params.toString()}`);
    const data = await response.json();
    setRows(data.transactions ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows().catch(() => setLoading(false));
  }, [days, category, needsReviewOnly]);

  useEffect(() => {
    const fetchCategories = async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.categories)) {
        setCategoryList(data.categories);
      }
    };
    fetchCategories().catch(() => null);
  }, []);

  const filteredRows = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(trimmed) ||
        row.category.toLowerCase().includes(trimmed)
    );
  }, [query, rows]);

  const similarTransactions = useMemo(() => {
    if (!selected) return [];
    return rows
      .filter((row) => row.id !== selected.id && row.name === selected.name)
      .slice(0, 6);
  }, [rows, selected]);

  const similarCount = useMemo(() => {
    if (!selected) return 0;
    return rows.filter((row) => row.name === selected.name).length;
  }, [rows, selected]);

  const splitTotal = useMemo(
    () => splits.reduce((acc, split) => acc + (Number(split.amount) || 0), 0),
    [splits]
  );

  const remainingSplit = useMemo(() => {
    if (!selected) return 0;
    return Math.max(0, Math.abs(selected.amount) - splitTotal);
  }, [selected, splitTotal]);

  const canSaveSplits = useMemo(() => {
    if (!selected) return false;
    if (splits.length === 0) return false;
    if (splitTotal <= 0) return false;
    return splitTotal <= Math.abs(selected.amount) + 0.01;
  }, [selected, splits, splitTotal]);

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
                <p className="text-sm font-semibold">LEDGR</p>
                <p className="text-xs text-[color:var(--ink-soft)]">Client view</p>
              </div>
            </div>
          </div>
          <nav className="space-y-2 rounded-3xl bg-white/80 p-4 ring-soft">
            {[
              { label: "Dashboard", href: "/client" },
              { label: "Distribution", href: "/distribution" },
              { label: "Transactions", href: "/transactions", active: true },
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
                    : item.active
                    ? "bg-white/70 text-[color:var(--ink)] shadow-sm"
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
                Transactions
              </p>
              <h1 className="font-display text-3xl md:text-4xl">
                All transactions
              </h1>
              <p className="text-sm text-[color:var(--ink-soft)]">
                Review, re-categorize, and drill into the details.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SignOutButton className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]" />
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className="rounded-[32px] bg-white/85 p-6 ring-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">All transactions</span>
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs text-[color:var(--ink-soft)] ring-soft">
                    {rows.length} total
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[color:var(--ink-soft)]">
                    Filter
                  </button>
                  <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[color:var(--ink-soft)]">
                    Sort
                  </button>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search"
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[color:var(--ink-soft)]"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {dayOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDays(option.value)}
                    className={`rounded-full px-3 py-1 ${
                      days === option.value
                        ? "bg-[color:var(--ocean)] text-white"
                        : "border border-black/10 bg-white text-[color:var(--ink-soft)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[color:var(--ink-soft)]"
                >
                  {categoryOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setNeedsReviewOnly((prev) => !prev)}
                  className={`rounded-full px-3 py-1 ${
                    needsReviewOnly
                      ? "bg-amber-200 text-amber-900"
                      : "border border-black/10 bg-white text-[color:var(--ink-soft)]"
                  }`}
                >
                  Needs review
                </button>
                <button
                  onClick={async () => {
                    setCategorizing(true);
                    await fetch("/api/transactions/categorize", { method: "POST" });
                    setCategorizing(false);
                  }}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[color:var(--ink-soft)]"
                >
                  {categorizing ? "AI tagging..." : "AI tag"}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                    Loading transactions...
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                    No transactions found for this filter.
                  </div>
                ) : (
                  filteredRows.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={async () => {
                        setDetailLoading(true);
                        const response = await fetch(`/api/transactions/${tx.id}`);
                        const data = await response.json();
                        setSelected(data);
                        setCategoryInput(data.category ?? tx.category);
                        setTransactionTypeInput(
                          data.transactionType ?? "REGULAR"
                        );
                        setSplits(data.splits ?? []);
                        setApplyToSimilar(false);
                        setApplyToCategory(false);
                        setCreateRule(false);
                        setRuleMatchType("EXACT");
                        setRuleMatchValue(data.name ?? "");
                        setNotes("");
                        setDetailLoading(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-soft transition ${
                        selected?.id === tx.id
                          ? "bg-white shadow-md"
                          : "bg-white/70 hover:bg-white/90"
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{tx.name}</p>
                          {tx.needsReview ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                              Needs review
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-[color:var(--ink-soft)]">
                          {tx.category} · {tx.date}
                        </p>
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          tx.isIncome ? "text-emerald-600" : "text-[color:var(--ink)]"
                        }`}
                      >
                        {tx.isIncome ? "+" : "-"}${tx.amount.toFixed(2)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[32px] bg-white/85 p-6 ring-soft lg:sticky lg:top-6 lg:h-fit">
              {detailLoading ? (
                <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                  Loading transaction details...
                </div>
              ) : selected ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                        Regular transaction
                      </p>
                      <p className="text-xs text-[color:var(--ink-soft)]">
                        {new Date(selected.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    {selected.needsReview ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900">
                        To review
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">{selected.name}</h2>
                    <span className="text-lg font-semibold">
                      {selected.amount < 0 ? "-" : "+"}$
                      {Math.abs(selected.amount).toFixed(2)}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
                        Category
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <select
                          value={categoryInput}
                          onChange={(event) => setCategoryInput(event.target.value)}
                          className="w-full rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                        >
                          {categoryOptions
                            .filter((item) => item !== "All")
                            .map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                        </select>
                        <input
                          value={categoryInput}
                          onChange={(event) => setCategoryInput(event.target.value)}
                          placeholder="Or type a new category"
                          className="w-full rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
                        Type
                      </p>
                      <select
                        value={transactionTypeInput}
                        onChange={(event) =>
                          setTransactionTypeInput(
                            event.target.value as
                              | "INCOME"
                              | "INTERNAL_TRANSFER"
                              | "REGULAR"
                          )
                        }
                        className="mt-2 w-full rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                      >
                        <option value="REGULAR">Regular</option>
                        <option value="INTERNAL_TRANSFER">Internal transfer</option>
                        <option value="INCOME">Income</option>
                      </select>
                      <p className="mt-2 text-[11px] text-[color:var(--ink-soft)]">
                        Internal transfers are excluded from spending.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
                        Account
                      </p>
                      <div className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-sm ring-soft">
                        <p className="font-medium">
                          {selected.account?.institutionName ?? "Bank"} ·{" "}
                          {selected.account?.name}
                        </p>
                        <p className="text-xs text-[color:var(--ink-soft)]">
                          {selected.account?.type}
                          {selected.account?.mask
                            ? ` · •••• ${selected.account.mask}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
                      Notes
                    </p>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Add a note"
                      className="mt-2 min-h-[120px] w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[color:var(--ink)]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
                          Split transaction
                        </p>
                        <p className="text-[11px] text-[color:var(--ink-soft)]">
                          Split amounts are treated as separate category lines.
                        </p>
                      </div>
                      <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] text-[color:var(--ink-soft)] ring-soft">
                        Remaining {remainingSplit.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {splits.length === 0 ? (
                        <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                          No splits yet. Add line items below.
                        </div>
                      ) : (
                        splits.map((split, index) => (
                          <div
                            key={split.id ?? index}
                            className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 ring-soft"
                          >
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={split.amount}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setSplits((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index
                                      ? { ...item, amount: Number.isNaN(value) ? 0 : value }
                                      : item
                                  )
                                );
                              }}
                              className="w-28 rounded-full border border-black/10 bg-white px-3 py-2 text-xs"
                              placeholder="Amount"
                            />
                            <input
                              value={split.category}
                              onChange={(event) =>
                                setSplits((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index
                                      ? { ...item, category: event.target.value }
                                      : item
                                  )
                                )
                              }
                              className="flex-1 rounded-full border border-black/10 bg-white px-3 py-2 text-xs"
                              placeholder="Category"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setSplits((prev) =>
                                  prev.filter((_, idx) => idx !== index)
                                )
                              }
                              className="rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] text-[color:var(--ink-soft)]"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSplits((prev) => [
                            ...prev,
                            {
                              category:
                                categoryList.find((item) => item !== "All") ??
                                "Uncategorized",
                              amount: Math.max(0, Number(remainingSplit.toFixed(2))),
                            },
                          ])
                        }
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs text-[color:var(--ink-soft)]"
                      >
                        Add split
                      </button>
                      {selected && splitTotal > Math.abs(selected.amount) + 0.01 ? (
                        <span className="text-[11px] text-amber-700">
                          Split total exceeds the transaction amount.
                        </span>
                      ) : null}
                      {splits.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selected) return;
                              if (!canSaveSplits) return;
                              setSplitSaving(true);
                              const payload = splits
                                .map((split) => ({
                                  category: split.category.trim(),
                                  amount: Number(split.amount),
                                  note: split.note ?? null,
                                }))
                                .filter((split) => split.category && split.amount > 0);
                              const response = await fetch(
                                `/api/transactions/${selected.id}/splits`,
                                {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ splits: payload }),
                                }
                              );
                              if (response.ok) {
                                setSelected((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        splits: payload,
                                        hasSplits: payload.length > 0,
                                      }
                                    : prev
                                );
                                await fetchRows();
                              }
                              setSplitSaving(false);
                            }}
                            className={`rounded-full px-4 py-2 text-xs font-semibold ${
                              canSaveSplits
                                ? "bg-[color:var(--ocean)] text-white"
                                : "cursor-not-allowed bg-slate-200 text-slate-500"
                            }`}
                          >
                            {splitSaving ? "Saving..." : "Save splits"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selected) return;
                              setSplitSaving(true);
                              await fetch(`/api/transactions/${selected.id}/splits`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ splits: [] }),
                              });
                              setSplits([]);
                              setSelected((prev) =>
                                prev ? { ...prev, splits: [], hasSplits: false } : prev
                              );
                              setRows((prev) =>
                                prev.map((row) =>
                                  row.id === selected.id
                                    ? { ...row, category: row.category, hasSplits: false }
                                    : row
                                )
                              );
                              setSplitSaving(false);
                            }}
                            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs text-[color:var(--ink-soft)]"
                          >
                            Clear splits
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
                      <input
                        type="checkbox"
                        checked={applyToSimilar}
                        onChange={(event) =>
                          setApplyToSimilar(event.target.checked)
                        }
                      />
                      Apply to similar transactions
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
                      <input
                        type="checkbox"
                        checked={applyToCategory}
                        onChange={(event) =>
                          setApplyToCategory(event.target.checked)
                        }
                      />
                      Apply to all “{selected.category}” transactions
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
                      <input
                        type="checkbox"
                        checked={createRule}
                        onChange={(event) =>
                          setCreateRule(event.target.checked)
                        }
                      />
                      Create a rule for new transactions
                    </label>
                    {applyToSimilar && similarCount > 1 ? (
                      <span className="text-[11px] text-[color:var(--ink-soft)]">
                        {similarCount - 1} other match
                        {similarCount - 1 === 1 ? "" : "es"}
                      </span>
                    ) : null}
                    {selected.needsReview ? (
                      <button
                          onClick={async () => {
                          setReviewingId(selected.id);
                          await fetch("/api/transactions/review", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: selected.id }),
                          });
                          setRows((prev) =>
                            prev.map((row) =>
                              row.id === selected.id
                                ? { ...row, needsReview: false }
                                : row
                            )
                          );
                          setSelected((prev) =>
                            prev ? { ...prev, needsReview: false } : prev
                          );
                          setReviewingId(null);
                        }}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[color:var(--ink-soft)]"
                      >
                        {reviewingId === selected.id ? "Reviewing..." : "Mark reviewed"}
                      </button>
                    ) : null}
                    <button
                      onClick={async () => {
                        await fetch(`/api/transactions/${selected.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            category: categoryInput,
                            transactionType: transactionTypeInput,
                            applyToSimilar,
                            applyToCategory,
                            createRule,
                            ruleMatchType,
                            ruleMatchValue,
                          }),
                        });
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === selected.id
                              ? { ...row, category: categoryInput, needsReview: false }
                              : row
                          )
                        );
                        if (applyToSimilar && categoryInput.trim()) {
                          setRows((prev) =>
                            prev.map((row) =>
                              row.name === selected.name
                                ? { ...row, category: categoryInput, needsReview: false }
                                : row
                            )
                          );
                        }
                        if (categoryInput.trim() && !categoryList.includes(categoryInput)) {
                          setCategoryList((prev) => [...prev, categoryInput].sort());
                        }
                        setSelected((prev) =>
                          prev
                            ? {
                                ...prev,
                                category: categoryInput,
                                transactionType: transactionTypeInput,
                                needsReview: false,
                              }
                            : prev
                        );
                      }}
                      className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-xs font-semibold text-white"
                    >
                      Save changes
                    </button>
                  </div>

                  {applyToSimilar && similarTransactions.length > 0 ? (
                    <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                        Will update
                      </p>
                      <div className="mt-3 space-y-2">
                        {similarTransactions.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between"
                          >
                            <div>
                              <p className="text-xs font-medium text-[color:var(--ink)]">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-[color:var(--ink-soft)]">
                                {item.category} · {item.date}
                              </p>
                            </div>
                            <span className="text-[11px] font-semibold text-[color:var(--ink)]">
                              {item.isIncome ? "+" : "-"}$
                              {item.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {similarCount - 1 > similarTransactions.length ? (
                          <p className="text-[11px] text-[color:var(--ink-soft)]">
                            +{similarCount - 1 - similarTransactions.length} more
                          </p>
                    ) : null}
                  </div>

                  {createRule ? (
                    <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                        Rule match
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRuleMatchType("EXACT")}
                          className={`rounded-full px-3 py-1 text-xs ${
                            ruleMatchType === "EXACT"
                              ? "bg-[color:var(--ocean)] text-white"
                              : "border border-black/10 bg-white text-[color:var(--ink-soft)]"
                          }`}
                        >
                          Exact match
                        </button>
                        <button
                          type="button"
                          onClick={() => setRuleMatchType("PARTIAL")}
                          className={`rounded-full px-3 py-1 text-xs ${
                            ruleMatchType === "PARTIAL"
                              ? "bg-[color:var(--ocean)] text-white"
                              : "border border-black/10 bg-white text-[color:var(--ink-soft)]"
                          }`}
                        >
                          Partial match
                        </button>
                      </div>
                      <input
                        value={ruleMatchValue}
                        onChange={(event) => setRuleMatchValue(event.target.value)}
                        placeholder="Match text"
                        className="mt-3 w-full rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-[color:var(--ink)]"
                      />
                      <p className="mt-2 text-[11px] text-[color:var(--ink-soft)]">
                        Future transactions that match this name will auto‑apply
                        the category.
                      </p>
                    </div>
                  ) : null}
                    </div>
                  ) : null}

                  {similarTransactions.length > 0 ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
                        Similar transactions
                      </p>
                      <div className="mt-3 space-y-2">
                        {similarTransactions.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-2 text-xs ring-soft"
                          >
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-[color:var(--ink-soft)]">
                                {item.category} · {item.date}
                              </p>
                            </div>
                            <span className="font-semibold">
                              {item.isIncome ? "+" : "-"}${item.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                  Select a transaction to view details.
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
