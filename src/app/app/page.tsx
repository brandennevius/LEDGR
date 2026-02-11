import Link from "next/link";
import { requireAuthedUser } from "@/lib/auth";
import { getCoachDashboardData } from "@/lib/dashboardData";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

const navItems = [
  "Overview",
  "Cash Flow",
  "Distribution",
  "Transactions",
  "Budgets",
  "Goals",
  "Accounts",
  "Insights",
  "Coaching",
];

const budgets = [
  { name: "Dining", spent: 312, limit: 420 },
  { name: "Groceries", spent: 276, limit: 340 },
  { name: "Subscriptions", spent: 89, limit: 90 },
  { name: "Transport", spent: 142, limit: 180 },
];

const goals = [
  { name: "Emergency Fund", current: 4200, target: 8000 },
  { name: "Credit Card Payoff", current: 3200, target: 6200 },
  { name: "Buffer Days", current: 12.4, target: 18 },
];

const coachSignals = [
  {
    title: "Late-night dining spikes",
    detail: "3 rule breaks in the last 7 days.",
  },
  {
    title: "Subscription creep",
    detail: "Added two services this cycle.",
  },
];

export default async function Dashboard() {
  const user = await requireAuthedUser();
  const data = await getCoachDashboardData(user);
  return (
    <div className="min-h-screen bg-transparent text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[26%] h-[320px] w-[320px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-100px] top-[6%] h-[260px] w-[260px] rounded-full bg-amber-100/60 blur-[120px]" />

      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-black/5 bg-[rgba(255,255,255,0.6)] p-6 backdrop-blur lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--ocean)] text-white">
              A
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--ocean)]">
                LEDGR
              </p>
              <p className="text-xs text-[color:var(--ink-soft)]">Coach view</p>
            </div>
          </div>
          <nav className="mt-10 space-y-2 text-sm">
            {navItems.map((item, index) => (
              <button
                key={item}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-2 text-left transition ${
                  index === 0
                    ? "bg-[color:var(--ocean)] text-white shadow-md"
                    : "text-[color:var(--ink-soft)] hover:bg-white/80"
                }`}
              >
                {item}
                {index === 0 ? (
                  <span className="text-xs text-white/70">Live</span>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-3xl bg-white/80 p-4 ring-soft">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Coach notes
            </p>
            <p className="mt-2 text-sm font-medium">Next review in 4 days</p>
            <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
              Focus: dining volatility + subscription cleanup.
            </p>
            <button className="mt-4 w-full rounded-full bg-[color:var(--ocean)] px-4 py-2 text-xs font-semibold text-white">
              Prepare review
            </button>
          </div>
        </aside>

        <main className="flex-1 px-6 pb-16 pt-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                Overview
              </p>
              <h1 className="font-display text-3xl md:text-4xl">
                Good afternoon, {data.clientName}.
              </h1>
              <p className="text-sm text-[color:var(--ink-soft)]">
                Cycle 06 · 9 days remaining · Last synced 2 hours ago
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
              >
                Back to landing
              </Link>
              <Link
                href="/coach/review"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
              >
                Review summary
              </Link>
              <SignOutButton className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]" />
              <button className="rounded-full bg-[color:var(--ocean)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20">
                Add transaction
              </button>
            </div>
          </div>

          <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: "Net worth",
                    value: `$${data.netWorth.toLocaleString()}`,
                    delta: "Live",
                  },
                  {
                    label: "Monthly surplus",
                    value: `$${data.monthlySurplus.toLocaleString()}`,
                    delta: "Last 30 days",
                  },
                  {
                    label: "Buffer days",
                    value: data.bufferDays.toFixed(1),
                    delta: "Based on cash",
                  },
                ].map((card) => (
                  <div key={card.label} className="glass rounded-3xl p-5">
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      {card.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                    <p className="text-xs text-emerald-700">{card.delta}</p>
                  </div>
                ))}
              </div>

              <div className="glass rounded-[32px] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                      Cash flow
                    </p>
                    <p className="text-lg font-semibold">This cycle</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    Stable
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-12 gap-2">
                  {[18, 32, 26, 40, 22, 34, 28, 38, 24, 30, 20, 36].map(
                    (height, index) => (
                      <div
                        key={`${height}-${index}`}
                        className={`flex h-32 items-end justify-center rounded-full ${
                          index % 3 === 0 ? "bg-emerald-200" : "bg-amber-200"
                        }`}
                      >
                        <div
                          className="w-full rounded-full bg-[color:var(--ocean)]/70"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    )
                  )}
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      Income
                    </p>
                    <p className="text-lg font-semibold">$5,120</p>
                  </div>
                  <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      Spend
                    </p>
                    <p className="text-lg font-semibold">$4,700</p>
                  </div>
                  <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                    <p className="text-xs text-[color:var(--ink-soft)]">
                      Debt paid
                    </p>
                    <p className="text-lg font-semibold">$540</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[28px] bg-white/80 p-5 ring-soft">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Spending pulse</p>
                    <span className="text-xs text-emerald-700">Improving</span>
                  </div>
                  <svg viewBox="0 0 240 80" className="mt-4 h-20 w-full">
                    <path
                      d="M4 52 C40 44 68 60 96 54 C130 48 150 34 188 38 C212 41 230 30 236 24"
                      fill="none"
                      stroke="url(#pulse)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="pulse" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#0c7a7a" />
                        <stop offset="100%" stopColor="#7ccf84" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    Volatility down 19% since last cycle.
                  </p>
                </div>
                <div className="rounded-[28px] bg-white/80 p-5 ring-soft">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Coach signals</p>
                    <span className="text-xs text-amber-700">2 active</span>
                  </div>
                  <ul className="mt-4 space-y-3 text-xs text-[color:var(--ink-soft)]">
                    {coachSignals.map((signal) => (
                      <li key={signal.title}>
                        <p className="font-medium text-[color:var(--ink)]">
                          {signal.title}
                        </p>
                        <p>{signal.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass rounded-[32px] p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Budgets</p>
                  <span className="text-xs text-[color:var(--ink-soft)]">
                    This cycle
                  </span>
                </div>
                <div className="mt-4 space-y-4">
                  {budgets.map((budget) => {
                    const progress = Math.min(
                      100,
                      Math.round((budget.spent / budget.limit) * 100)
                    );
                    return (
                      <div key={budget.name}>
                        <div className="flex items-center justify-between text-xs">
                          <span>{budget.name}</span>
                          <span className="text-[color:var(--ink-soft)]">
                            ${budget.spent} / ${budget.limit}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-emerald-100">
                          <div
                            className={`h-2 rounded-full ${
                              progress > 90 ? "bg-amber-400" : "bg-emerald-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass rounded-[32px] p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Goals</p>
                  <span className="text-xs text-[color:var(--ink-soft)]">
                    Long-term
                  </span>
                </div>
                <div className="mt-4 space-y-4">
                  {goals.map((goal) => {
                    const progress = Math.min(
                      100,
                      Math.round((goal.current / goal.target) * 100)
                    );
                    return (
                      <div key={goal.name}>
                        <div className="flex items-center justify-between text-xs">
                          <span>{goal.name}</span>
                          <span className="text-[color:var(--ink-soft)]">
                            {goal.current} / {goal.target}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-[color:var(--ocean)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[32px] bg-[color:var(--ink)] p-6 text-white">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                  Coach insight
                </p>
                <p className="mt-2 text-lg font-semibold">
                  You recover quickly after slips.
                </p>
                <p className="mt-2 text-sm text-emerald-50/80">
                  Relapse window dropped from 4 days to 2. Keep the buffer rule
                  intact through weekends.
                </p>
                <button className="mt-5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[color:var(--ink)]">
                  Review insights
                </button>
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Recent activity</p>
                <span className="text-xs text-[color:var(--ink-soft)]">
                  Last 7 days
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {data.recentTransactions.map((tx) => (
                  <div
                    key={`${tx.name}-${tx.day}`}
                    className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 ring-soft"
                  >
                    <div>
                      <p className="text-sm font-medium">{tx.name}</p>
                      <p className="text-xs text-[color:var(--ink-soft)]">
                        {tx.category} · {tx.day}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        tx.isIncome ? "text-emerald-600" : "text-[color:var(--ink)]"
                      }`}
                    >
                      {tx.isIncome ? "+" : "-"}$
                      {tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Upcoming bills</p>
                <span className="text-xs text-[color:var(--ink-soft)]">
                  Next 14 days
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[color:var(--ink-soft)]">
                {[
                  { name: "Rent", date: "Feb 05", amount: 1680 },
                  { name: "Student loan", date: "Feb 09", amount: 210 },
                  { name: "Phone plan", date: "Feb 12", amount: 84 },
                ].map((bill) => (
                  <div
                    key={bill.name}
                    className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 ring-soft"
                  >
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">
                        {bill.name}
                      </p>
                      <p className="text-xs">{bill.date}</p>
                    </div>
                    <span className="font-semibold text-[color:var(--ink)]">
                      ${bill.amount}
                    </span>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[color:var(--ink-soft)]">
                View cash plan
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
