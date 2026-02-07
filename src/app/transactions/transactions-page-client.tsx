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
  date: string;
};

type TransactionDetail = {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  needsReview?: boolean;
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
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState("");

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

                  <div className="flex flex-wrap items-center gap-2">
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
                        if (!categoryInput.trim()) return;
                        await fetch(`/api/transactions/${selected.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ category: categoryInput }),
                        });
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === selected.id
                              ? { ...row, category: categoryInput, needsReview: false }
                              : row
                          )
                        );
                        if (!categoryList.includes(categoryInput)) {
                          setCategoryList((prev) => [...prev, categoryInput].sort());
                        }
                        setSelected((prev) =>
                          prev ? { ...prev, category: categoryInput, needsReview: false } : prev
                        );
                      }}
                      className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-xs font-semibold text-white"
                    >
                      Save changes
                    </button>
                  </div>

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
