import Link from "next/link";
import { requireAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import GoalSetupWizardClient from "@/components/GoalSetupWizardClient";
import { computeCashOnHand } from "@/lib/goals";

export const dynamic = "force-dynamic";

const paymentPattern = /payment|loan|mortgage|student|auto|credit/i;

export default async function GoalsSetupPage() {
  const user = await requireAuthedUser();
  const [accounts, transactions, goals] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 800,
    }),
    prisma.goal.findMany({ where: { userId: user.id }, select: { id: true } }),
  ]);

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const debtAccounts = accounts
    .filter((account) => {
      const typeValue = account.type?.toLowerCase() ?? "";
      const subtypeValue = account.subtype?.toLowerCase() ?? "";
      return (
        typeValue.includes("credit") ||
        typeValue.includes("loan") ||
        subtypeValue.includes("loan") ||
        subtypeValue.includes("mortgage") ||
        subtypeValue.includes("student") ||
        subtypeValue.includes("auto")
      );
    })
    .map((account) => {
      const balance = Math.abs(
        account.currentBalance ?? account.availableBalance ?? 0
      );
      const recentPayments = transactions.filter((tx) => {
        if (tx.accountId !== account.id) return false;
        if (tx.date < since) return false;
        if (tx.amount <= 0) return false;
        const name = (tx.merchantName ?? tx.name ?? "").toLowerCase();
        const category = (tx.category ?? "").toLowerCase();
        return paymentPattern.test(name) || paymentPattern.test(category);
      });
      const estimatedPayment =
        recentPayments.length > 0
          ? recentPayments.reduce((acc, tx) => acc + tx.amount, 0) / 3
          : null;
      return {
        id: account.id,
        name: account.name,
        institutionName: account.institutionName,
        mask: account.mask,
        balance,
        estimatedPayment,
      };
    });

  const liquidCash = computeCashOnHand(accounts);

  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[6%] h-[360px] w-[360px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[14%] h-[320px] w-[320px] rounded-full bg-amber-100/60 blur-[120px]" />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-20 pt-10">
        <div className="flex items-center justify-end">
          <Link
            href="/goals"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
          >
            Back to goals
          </Link>
        </div>

        <GoalSetupWizardClient
          debtAccounts={debtAccounts}
          hasExistingGoals={goals.length > 0}
          liquidCash={liquidCash}
        />
      </main>
    </div>
  );
}
