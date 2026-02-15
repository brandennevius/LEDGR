import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuthedUser } from "@/lib/auth";
import { resolveCategoryColor } from "@/lib/categoryColors";
import CategoriesOverviewClient from "@/components/CategoriesOverviewClient";

export const dynamic = "force-dynamic";

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export default async function CategoriesPage() {
  const user = await requireAuthedUser();
  const [settings, groups, transactions] = await Promise.all([
    prisma.category.findMany({ where: { userId: user.id } }),
    prisma.categoryGroup.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = formatMonthKey(prevMonthStart);
  const currentMonthKey = formatMonthKey(now);
  const daysElapsed = Math.max(
    1,
    Math.floor((now.getTime() - monthStart.getTime()) / 86400000) + 1
  );
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const currentSpend = new Map<string, number>();
  const prevSpend = new Map<string, number>();

  transactions.forEach((tx) => {
    if (tx.amount <= 0) return;
    const category = tx.category ?? "Uncategorized";
    const key = formatMonthKey(tx.date);
    if (key === currentMonthKey) {
      currentSpend.set(category, (currentSpend.get(category) ?? 0) + tx.amount);
    } else if (key === prevMonthKey) {
      prevSpend.set(category, (prevSpend.get(category) ?? 0) + tx.amount);
    }
  });

  const settingsMap = new Map(settings.map((item) => [item.name, item]));
  const categoryNames = new Set([
    ...Array.from(currentSpend.keys()),
    ...Array.from(prevSpend.keys()),
    ...settings.map((item) => item.name),
  ]);

  const categories = Array.from(categoryNames)
    .filter(Boolean)
    .map((name) => {
      const setting = settingsMap.get(name);
      const spend = currentSpend.get(name) ?? 0;
      const previous = prevSpend.get(name) ?? 0;
      const budget = setting?.monthlyBudget ?? null;
      const projected = spend > 0 ? (spend / daysElapsed) * daysInMonth : 0;
      const remaining = budget !== null ? budget - spend : null;
      const status: "ok" | "risk" | "over" | "neutral" =
        budget === null
          ? "neutral"
          : spend > budget
          ? "over"
          : projected > budget
          ? "risk"
          : "ok";
      return {
        name,
        color: resolveCategoryColor(name, setting?.color),
        spend,
        prevSpend: previous,
        budget,
        essential: setting?.essential ?? false,
        projected,
        remaining,
        status,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const totalSpend = categories.reduce((acc, row) => acc + row.spend, 0);
  const totalBudget = settings.reduce(
    (acc, row) => acc + (row.monthlyBudget ?? 0),
    0
  );
  const totalPrevSpend = categories.reduce((acc, row) => acc + row.prevSpend, 0);
  const projectedTotal = totalSpend > 0 ? (totalSpend / daysElapsed) * daysInMonth : 0;
  const changePct =
    totalPrevSpend === 0 ? 0 : ((totalSpend - totalPrevSpend) / totalPrevSpend) * 100;

  const summary = {
    mode: totalBudget > 0 ? ("budget" as const) : ("compare" as const),
    spend: totalSpend,
    budget: totalBudget,
    projected: projectedTotal,
    prevSpend: totalPrevSpend,
    changePct,
  };

  const groupsData = groups.map((group) => {
    const groupCategories = categories.filter((item) =>
      group.categories.includes(item.name)
    );
    const spend = groupCategories.reduce((acc, item) => acc + item.spend, 0);
    const budget =
      groupCategories.reduce((acc, item) => acc + (item.budget ?? 0), 0) +
      (group.unassignedBudget ?? 0);
    const projected = spend > 0 ? (spend / daysElapsed) * daysInMonth : 0;
    const status: "ok" | "risk" | "over" | "neutral" =
      budget === 0
        ? "neutral"
        : spend > budget
        ? "over"
        : projected > budget
        ? "risk"
        : "ok";
    return {
      id: group.id,
      name: group.name,
      spend,
      budget: budget > 0 ? budget : null,
      unassignedBudget: group.unassignedBudget ?? null,
      status,
      categories: groupCategories,
    };
  });

  const transactionsData = transactions.map((tx) => ({
    id: tx.id,
    name: tx.merchantName ?? tx.name,
    amount: tx.amount,
    category: tx.category ?? "Uncategorized",
    date: tx.date.toISOString(),
  }));

  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[6%] h-[360px] w-[360px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[14%] h-[320px] w-[320px] rounded-full bg-amber-100/60 blur-[120px]" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-20 pt-8">
        <div className="flex items-center justify-end">
          <Link
            href="/client"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
          >
            Back to dashboard
          </Link>
        </div>
        <CategoriesOverviewClient
          summary={summary}
          categories={categories}
          groups={groupsData}
          transactions={transactionsData}
        />
      </main>
    </div>
  );
}
