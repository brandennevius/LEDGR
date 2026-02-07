import Link from "next/link";
import { requireAuthedUser } from "@/lib/auth";
import { getClientOverviewData } from "@/lib/dashboardData";

export const dynamic = "force-dynamic";

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default async function AccountsPage() {
  const user = await requireAuthedUser();
  const data = await getClientOverviewData(user);

  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[6%] h-[360px] w-[360px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[14%] h-[320px] w-[320px] rounded-full bg-amber-100/60 blur-[120px]" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Linked accounts
            </p>
            <h1 className="font-display text-3xl md:text-4xl">
              All connected accounts.
            </h1>
            <p className="text-sm text-[color:var(--ink-soft)]">
              {data.clientName} · {data.accounts.length} accounts
            </p>
          </div>
          <Link
            href="/client"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
          >
            Back to client view
          </Link>
        </header>

        <section className="rounded-[32px] bg-white/85 p-6 ring-soft">
          <div className="space-y-3">
            {data.accounts.map((account, index) => (
              <div
                key={`${account.name}-${account.mask ?? "na"}-${index}`}
                className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 ring-soft"
              >
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    {account.institutionName ?? "Bank"} · {account.type}
                    {account.mask ? ` · •••• ${account.mask}` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {formatCurrency(account.balance)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
