"use client";

import { useState } from "react";
import Link from "next/link";
import PlaidLinkButton from "@/components/PlaidLinkButton";

type Account = {
  id: string;
  plaidItemId?: string;
  name: string;
  type: string;
  mask?: string;
  institutionName?: string;
  balance: number;
};

type Connection = {
  id: string;
  itemId: string;
  institutionName?: string;
  status: string;
  updatedAt: string;
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
  connections,
}: {
  clientName: string;
  accounts: Account[];
  connections: Connection[];
}) {
  const [items, setItems] = useState(accounts);
  const [connectionsState, setConnectionsState] = useState(connections);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingAll, setRemovingAll] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const itemIdByInternal = new Map(
    connectionsState.map((connection) => [connection.id, connection.itemId])
  );
  const connectionCounts = new Map<string, number>();
  connectionsState.forEach((connection) => {
    connectionCounts.set(connection.itemId, 0);
  });

  items.forEach((account) => {
    if (!account.plaidItemId) return;
    const itemId = itemIdByInternal.get(account.plaidItemId);
    if (!itemId) return;
    connectionCounts.set(itemId, (connectionCounts.get(itemId) ?? 0) + 1);
  });

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
    setConnectionsState([]);
    setRemovingAll(false);
  };

  const syncNow = async () => {
    setSyncing(true);
    await fetch("/api/plaid/accounts/sync", { method: "POST" });
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
              {clientName} · {items.length} accounts ·{" "}
              {connectionsState.length} connections
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                Connections
              </p>
              <h2 className="font-display text-2xl">
                Bank logins and sync status.
              </h2>
            </div>
            <PlaidLinkButton label="Add connection" />
          </div>
          <div className="mt-5 space-y-3">
            {connectionsState.length === 0 ? (
              <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
                No connections yet. Link a bank to get started.
              </div>
            ) : (
              connectionsState.map((connection) => (
                <div
                  key={connection.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/70 px-4 py-3 ring-soft"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {connection.institutionName ?? "Bank connection"}
                    </p>
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      Status: {connection.status} ·{" "}
                      {connectionCounts.get(connection.itemId) ?? 0} accounts
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[color:var(--ink-soft)]">
                      Updated {new Date(connection.updatedAt).toLocaleDateString()}
                    </span>
                    {connection.status !== "active" ? (
                      <PlaidLinkButton
                        mode="update"
                        itemId={connection.itemId}
                        label="Reverify"
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[color:var(--ink-soft)]"
                        onLinked={async () => {
                          const refreshed = await fetch(
                            "/api/plaid/items",
                            { method: "GET" }
                          ).catch(() => null);
                          if (refreshed?.ok) {
                            const data = await refreshed.json();
                            if (Array.isArray(data?.items)) {
                              setConnectionsState(data.items);
                            }
                          }
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

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
