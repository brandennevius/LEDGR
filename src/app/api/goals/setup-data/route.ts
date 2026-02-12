import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { computeCashOnHand } from "@/lib/goals";

const paymentPattern = /payment|loan|mortgage|student|auto|credit/i;

export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({
    debtAccounts,
    hasExistingGoals: goals.length > 0,
    liquidCash,
  });
}
