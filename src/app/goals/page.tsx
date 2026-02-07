import Link from "next/link";
import GoalsClient from "@/components/GoalsClient";
import { requireAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildClientSnapshot } from "@/utils/trends";
import { computeCashOnHand, hydrateGoals } from "@/lib/goals";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await requireAuthedUser();

  const [goals, accounts, transactions] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({ where: { userId: user.id } }),
  ]);

  const cashOnHand = computeCashOnHand(accounts);
  const snapshot = buildClientSnapshot({
    asOf: new Date(),
    transactions: transactions.map((tx) => ({
      amount: tx.amount,
      date: tx.date,
      category: tx.category,
    })),
    cashOnHand,
    spendIsPositive: true,
  });

  const hydratedGoals = hydrateGoals({
    goals,
    transactions,
    accounts,
    bufferDays: snapshot.bufferDays,
  });

  const serializedGoals = hydratedGoals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    type: goal.type,
    cadence: goal.cadence,
    target: goal.target,
    current: goal.current,
    category: goal.category,
    accountId: goal.accountId,
    minPayment: goal.minPayment,
    interestRate: goal.interestRate,
    termMonths: goal.termMonths,
    status: goal.status,
    completedAt: goal.completedAt ? goal.completedAt.toISOString() : null,
    startDate: goal.startDate ? goal.startDate.toISOString() : null,
    endDate: goal.endDate ? goal.endDate.toISOString() : null,
  }));

  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[6%] h-[360px] w-[360px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[14%] h-[320px] w-[320px] rounded-full bg-amber-100/60 blur-[120px]" />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Goals
            </p>
            <h1 className="font-display text-3xl md:text-4xl">
              Set goals and track them in real time.
            </h1>
            <p className="text-sm text-[color:var(--ink-soft)]">
              Goals update automatically based on income, spending, and linked
              accounts.
            </p>
          </div>
          <Link
            href="/client"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
          >
            Back to client view
          </Link>
        </header>

        <GoalsClient
          initialGoals={serializedGoals}
          accounts={accounts.map((account) => ({
            id: account.id,
            name: account.name,
            type: account.type,
            subtype: account.subtype,
            mask: account.mask,
            institutionName: account.institutionName,
            currentBalance: account.currentBalance,
            availableBalance: account.availableBalance,
          }))}
        />
      </main>
    </div>
  );
}
