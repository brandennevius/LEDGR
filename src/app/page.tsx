import Link from "next/link";

const insightCards = [
  {
    title: "Behavior Diagnostics",
    text: "Detect the moments you drift off plan and pinpoint the habits that cause it.",
  },
  {
    title: "Consistency Tracking",
    text: "Measure discipline, recovery speed, and streaks across each coaching cycle.",
  },
  {
    title: "Risk Signals",
    text: "Spot overdraft danger and cash crunches before they become emergencies.",
  },
  {
    title: "Rule Effectiveness",
    text: "Test which guardrails actually change behavior and refine them fast.",
  },
];

const softwareHighlights = [
  {
    title: "Unified financial view",
    text: "Connect accounts to see net worth, cash flow, and spending in one calm dashboard.",
  },
  {
    title: "Insightful transactions",
    text: "Tag patterns and surfaces where money leaks or spikes happen most often.",
  },
  {
    title: "Budgets that adapt",
    text: "Dynamic guardrails adjust to life changes and irregular income.",
  },
  {
    title: "Goal runway",
    text: "Track debt payoff, savings build, and buffer days with a clear runway.",
  },
];

const steps = [
  {
    title: "Sync & diagnose",
    text: "We pull real behavior data and surface the few signals that matter.",
  },
  {
    title: "Coach review",
    text: "A human coach interprets the story behind your numbers every two weeks.",
  },
  {
    title: "Adjust & repeat",
    text: "Refine rules, re-prioritize debt, and keep momentum moving forward.",
  },
];

const tiers = [
  {
    name: "Software",
    price: "Self-guided",
    detail: "Automated insights + behavior analytics.",
  },
  {
    name: "Guided",
    price: "Best value",
    detail: "Async coach reviews every cycle.",
  },
  {
    name: "Premier",
    price: "Hands-on",
    detail: "Live calls + priority interventions.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-160px] top-[-140px] h-[360px] w-[360px] rounded-full bg-emerald-100/70 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[120px] h-[320px] w-[320px] rounded-full bg-amber-100/70 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-180px] left-[15%] h-[340px] w-[340px] rounded-full bg-sky-100/70 blur-[140px]" />

      <header className="sticky top-0 z-20 border-b border-black/5 bg-[rgba(247,247,242,0.8)] backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--ocean)] text-white">
              A
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--ocean)]">
                Arbor
              </p>
              <p className="text-xs text-[color:var(--ink-soft)]">
                Financial Coaching
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-6 text-sm text-[color:var(--ink-soft)] md:flex">
            <a href="#product" className="hover:text-[color:var(--ocean)]">
              Product
            </a>
            <a href="#insights" className="hover:text-[color:var(--ocean)]">
              Insights
            </a>
            <a href="#coaching" className="hover:text-[color:var(--ocean)]">
              Coaching
            </a>
            <a href="#pricing" className="hover:text-[color:var(--ocean)]">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5"
            >
              Start your first cycle
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 pb-24 pt-16">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.2em]">
              Software + Human Coaching
            </div>
            <h1 className="font-display text-4xl leading-tight text-[color:var(--ink)] md:text-5xl">
              Fix money habits for good.
              <br />
              Diagnose behavior. Build momentum.
            </h1>
            <p className="text-lg text-[color:var(--ink-soft)]">
              Arbor combines a behavior-first money platform with real coaches who
              interpret your data. We don’t just track spending — we change the
              patterns behind it.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button className="rounded-full bg-[color:var(--ocean)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5">
                Start your first cycle
              </button>
              <Link
                href="/client"
                className="rounded-full border border-[color:var(--ocean)]/20 bg-white px-6 py-3 text-sm font-semibold text-[color:var(--ocean-dark)] transition hover:-translate-y-0.5"
              >
                Explore the product
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[color:var(--ink-soft)]">
              <span className="rounded-full border border-black/10 px-3 py-1">
                Education + coaching only
              </span>
              <span className="rounded-full border border-black/10 px-3 py-1">
                No contracts, cancel anytime
              </span>
              <span className="rounded-full border border-black/10 px-3 py-1">
                Private and secure
              </span>
            </div>
          </div>

          <div className="glass relative overflow-hidden rounded-[32px] p-6">
            <div className="absolute right-[-60px] top-[-60px] h-44 w-44 rounded-full bg-emerald-300/30 blur-[90px]" />
            <div className="absolute bottom-[-50px] left-[-40px] h-44 w-44 rounded-full bg-amber-200/40 blur-[90px]" />
            <div className="relative space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                    Behavior Snapshot
                  </p>
                  <p className="text-lg font-semibold">Cycle 06 · In Progress</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  Consistency +8%
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    Buffer days
                  </p>
                  <p className="text-2xl font-semibold">12.4</p>
                  <p className="text-xs text-emerald-700">+3.1 since last cycle</p>
                </div>
                <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    Spend volatility
                  </p>
                  <p className="text-2xl font-semibold">Low</p>
                  <p className="text-xs text-emerald-700">Down 19% in 30 days</p>
                </div>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Coach priority</p>
                  <span className="text-xs text-amber-700">2 signals</span>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-[color:var(--ink-soft)]">
                  <li>Dining spikes after 9pm (3 events)</li>
                  <li>Subscriptions rose by $22 this cycle</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Software
            </p>
            <h2 className="font-display text-3xl md:text-4xl">
              A calm command center for your financial behavior.
            </h2>
            <p className="text-[color:var(--ink-soft)]">
              The platform connects accounts, tags behavior patterns, and builds
              rule-based guardrails. Every cycle adds insight so coaching gets
              smarter over time.
            </p>
            <div className="grid gap-4">
              {softwareHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl bg-white/80 p-4 ring-soft"
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-[color:var(--ink-soft)]">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="glass rounded-[32px] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                  Cash flow
                </p>
                <p className="text-lg font-semibold">Income vs Spend</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                +$420 surplus
              </span>
            </div>
            <div className="mt-6 grid grid-cols-6 gap-2">
              {["M", "T", "W", "T", "F", "S"].map((day, index) => (
                <div key={`${day}-${index}`} className="space-y-2 text-center text-xs">
                  <div
                    className={`mx-auto h-24 w-6 rounded-full ${
                      index % 2 === 0 ? "bg-emerald-200" : "bg-amber-200"
                    }`}
                  />
                  <span className="text-[color:var(--ink-soft)]">{day}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-3xl bg-white/80 p-4 ring-soft">
              <p className="text-sm font-medium">Net worth trend</p>
              <svg
                viewBox="0 0 240 80"
                className="mt-3 h-20 w-full"
                aria-hidden
              >
                <path
                  d="M4 60 C40 52 68 38 96 40 C130 44 150 18 188 24 C212 28 230 16 236 10"
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
            </div>
          </div>
        </section>

        <section id="insights" className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Differentiation
            </p>
            <h2 className="font-display text-3xl md:text-4xl">
              We coach behavior, not budgets.
            </h2>
            <p className="text-[color:var(--ink-soft)]">
              Traditional apps show what happened. We reveal why it keeps
              happening and help you fix it.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {insightCards.map((card) => (
              <div
                key={card.title}
                className="rounded-3xl bg-white/80 p-6 ring-soft"
              >
                <p className="text-lg font-semibold">{card.title}</p>
                <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                  {card.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="coaching" className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Coaching
            </p>
            <h2 className="font-display text-3xl md:text-4xl">
              A real coach reviews every cycle.
            </h2>
            <p className="text-[color:var(--ink-soft)]">
              We combine software diagnostics with expert interpretation. Coaches
              adjust rules, highlight risks, and keep you accountable without
              judgment.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-3xl bg-white/80 p-4 ring-soft"
                >
                  <p className="text-sm font-semibold">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 font-medium">{step.title}</p>
                  <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="glass rounded-[32px] p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Coach review
            </p>
            <p className="mt-2 text-2xl font-semibold">Next cycle plan</p>
            <div className="mt-5 space-y-4 text-sm text-[color:var(--ink-soft)]">
              <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                <p className="font-medium">Focus</p>
                <p>Reduce late-night spending by shifting weekend buffer.</p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                <p className="font-medium">Debt acceleration</p>
                <p>Route surplus to highest APR balance for 2 cycles.</p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                <p className="font-medium">New guardrail</p>
                <p>Dining cap set to $35 with a 2x/weekly limit.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                Pricing
              </p>
              <h2 className="font-display text-3xl md:text-4xl">
                Scale your support as you grow.
              </h2>
            </div>
            <button className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[color:var(--ink-soft)]">
              See availability
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className="rounded-[28px] bg-white/90 p-6 ring-soft transition hover:-translate-y-1"
              >
                <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                  {tier.name}
                </p>
                <p className="mt-2 text-2xl font-semibold">{tier.price}</p>
                <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                  {tier.detail}
                </p>
                <button className="mt-6 w-full rounded-full bg-[color:var(--ocean)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20">
                  Start cycle
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] bg-[color:var(--ink)] p-8 text-white md:p-12">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                Ready to start?
              </p>
              <h2 className="font-display text-3xl md:text-4xl">
                Begin your first coaching cycle in minutes.
              </h2>
              <p className="mt-3 text-sm text-emerald-50/80">
                Connect accounts, choose your cadence, and get a human review in
                two weeks.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <button className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[color:var(--ink)]">
                Start your first cycle
              </button>
              <span className="text-xs text-emerald-50/70">
                Education + coaching only. No investment advice.
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
