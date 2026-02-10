"use client";

import { useState } from "react";
import Link from "next/link";
import PlaidLinkButton from "@/components/PlaidLinkButton";

type Account = {
  id: string;
  name: string;
  type: string;
  mask?: string;
  institutionName?: string;
  balance: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function AccountsClient({
  clientName,
  accounts,
}: {
  clientName: string;
  accounts: Account[];
}) {
  const [items, setItems] = useState(accounts);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingAll, setRemovingAll] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const removeAccount = async (accountId: string) => {
    setRemovingId(accountId);
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    setItems((prev) => prev.filter((account) => account.id !== accountId));
    setRemovingId(null);
  };

  const removeAll = async () => {
    setRemovingAll(true);
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems([]);
    setRemovingAll(false);
  };

  const syncNow = async () => {
    setSyncing(true);
    await fetch("/api/plaid/transactions/sync", { method: "POST" });
    setSyncing(false);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[6%] h-[360px] w-[360px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[14%] h-[320px] w-[320px] rounded-full bg-amber-100/60 blur-[120px]" />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Linked accounts
            </p>
            <h1 className="font-display text-3xl md:text-4xl">
              Manage connected accounts.
            </h1>
            <p className="text-sm text-[color:var(--ink-soft)]">
              {clientName} · {items.length} accounts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PlaidLinkButton />
            <button
              type="button"
              onClick={syncNow}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
              disabled={syncing}
            >
              {syncing ? "Syncing..." : "Sync now"}
            </button>
            <button
              type="button"
              onClick={removeAll}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
              disabled={removingAll}
            >
              {removingAll ? "Removing..." : "Remove all"}
            </button>
            <Link
              href="/client"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
            >
              Back to client view
            </Link>
          </div>
        </header>

        <section className="rounded-[32px] bg-white/85 p-6 ring-soft">
          {items.length === 0 ? (
            <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
              No linked accounts yet. Connect a bank to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/70 px-4 py-3 ring-soft"
                >
                  <div>
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      {account.institutionName ?? "Bank"} · {account.type}
                      {account.mask ? ` · •••• ${account.mask}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">
                      {formatCurrency(account.balance)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAccount(account.id)}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[color:var(--ink-soft)]"
                      disabled={removingId === account.id}
                    >
                      {removingId === account.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
