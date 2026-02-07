"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TransactionRow = {
  id: string;
  name: string;
  category: string;
  amount: number;
  isIncome: boolean;
  needsReview?: boolean;
  source?: string;
  date: string;
};

type Props = {
  categories: string[];
};

const dayOptions = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export default function TransactionsDrilldown({ categories }: Props) {
  const [days, setDays] = useState<number>(30);
  const [category, setCategory] = useState<string>("All");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryList, setCategoryList] = useState<string[]>(categories);
  const [categorizing, setCategorizing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
    amount: number;
    category: string;
    date: string;
    account?: {
      name?: string;
      institutionName?: string;
      mask?: string;
      type?: string;
    };
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");

  const categoryOptions = useMemo(
    () => ["All", ...categoryList],
    [categoryList]
  );

  useEffect(() => {
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

  return (
    <section className="rounded-[32px] bg-white/85 p-6 ring-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Transactions drill-down</p>
          <p className="text-xs text-[color:var(--ink-soft)]">
            Filter by time range and category.
          </p>
        </div>
        <Link
          href="/categories"
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[color:var(--ink-soft)]"
        >
          Manage categories
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
            Loading transactions...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
            No transactions found for this filter.
          </div>
        ) : (
          rows.map((tx) => (
            <div
              key={tx.id}
              role="button"
              tabIndex={0}
              onClick={async () => {
                setDetailLoading(true);
                const response = await fetch(`/api/transactions/${tx.id}`);
                const data = await response.json();
                setSelected(data);
                setCategoryInput(data.category ?? tx.category);
                setDetailLoading(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
              className="flex w-full items-center justify-between rounded-2xl bg-white/70 px-4 py-3 text-left ring-soft transition hover:bg-white/90"
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
              <div className="flex items-center gap-3">
                {tx.needsReview ? (
                  <button
                    onClick={async (event) => {
                      event.stopPropagation();
                      setReviewingId(tx.id);
                      await fetch("/api/transactions/review", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: tx.id }),
                      });
                      setRows((prev) =>
                        prev.map((row) =>
                          row.id === tx.id ? { ...row, needsReview: false } : row
                        )
                      );
                      setReviewingId(null);
                    }}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[color:var(--ink-soft)]"
                  >
                    {reviewingId === tx.id ? "Reviewing..." : "Mark reviewed"}
                  </button>
                ) : null}
                <span
                  className={`text-sm font-semibold ${
                    tx.isIncome ? "text-emerald-600" : "text-[color:var(--ink)]"
                  }`}
                >
                  {tx.isIncome ? "+" : "-"}${tx.amount.toFixed(2)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                  Transaction
                </p>
                <h3 className="mt-2 text-2xl font-semibold">{selected.name}</h3>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  {new Date(selected.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full border border-black/10 px-3 py-1 text-xs"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-[color:var(--ink-soft)]">
                  Original info
                </p>
                <p className="text-sm font-medium">{selected.name}</p>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  {new Date(selected.date).toLocaleDateString("en-US")} · $
                  {Math.abs(selected.amount).toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
                  Category
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={categoryInput}
                    onChange={(event) => setCategoryInput(event.target.value)}
                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
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
                    className="flex-1 rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    onClick={async () => {
                      if (!categoryInput.trim()) return;
                      await fetch(`/api/transactions/${selected.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ category: categoryInput }),
                      });
                      setRows((prev) =>
                        prev.map((row) =>
                          row.id === selected.id
                            ? {
                                ...row,
                                category: categoryInput,
                                needsReview: false,
                              }
                            : row
                        )
                      );
                      if (!categoryList.includes(categoryInput)) {
                        setCategoryList((prev) => [...prev, categoryInput].sort());
                      }
                      setSelected(null);
                    }}
                    className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-[color:var(--ink-soft)]">Account</p>
                <p className="text-sm font-medium">
                  {selected.account?.institutionName ?? "Bank"} ·{" "}
                  {selected.account?.name}
                </p>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  {selected.account?.type}
                  {selected.account?.mask ? ` · •••• ${selected.account.mask}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
