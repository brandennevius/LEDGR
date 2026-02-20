import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help Center • LEDGR",
  description: "How to use LEDGR features across dashboard, transactions, cash flow, goals, and accounts.",
};

const sections = [
  {
    title: "Dashboard",
    bullets: [
      "Use Dashboard for a quick snapshot of cash position, budget status, and items needing review.",
      "Tap a card to drill into supporting transactions.",
      "Use Mark reviewed on review cards to clear the current batch.",
    ],
  },
  {
    title: "Transactions",
    bullets: [
      "Search, filter, and sort transactions by date, amount, category, and review status.",
      "Open a transaction to edit amount, category, and transaction type.",
      "Use split to divide one transaction across multiple categories.",
    ],
  },
  {
    title: "Cash Flow",
    bullets: [
      "Cash Flow compares income, spend, and net across recent periods.",
      "Use date range controls to move between month-to-date and trailing views.",
      "Tap chart points to inspect category-level drivers.",
    ],
  },
  {
    title: "Categories",
    bullets: [
      "Track spend against budget for each category.",
      "Open a category for monthly trend, key metrics, and category transactions.",
      "Edit category identity (name and color), budget, and group assignment.",
    ],
  },
  {
    title: "Goals",
    bullets: [
      "Create savings and payoff goals and track progress from linked accounts.",
      "Use contribution history to verify pace against your target date.",
    ],
  },
  {
    title: "Accounts",
    bullets: [
      "Manage connected institutions and refresh account sync status.",
      "Use reconnect when institutions require re-authentication.",
    ],
  },
  {
    title: "Penny (AI Coach)",
    bullets: [
      "Ask for spending summaries, budget risks, and category-specific explanations.",
      "Penny answers with account-aware coaching context from your LEDGR data.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">Support</p>
            <h1 className="font-display text-3xl md:text-4xl">LEDGR Help Center</h1>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
              Product walkthroughs and feature behavior.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
          >
            Back to home
          </Link>
        </header>

        <section className="space-y-5 rounded-[28px] bg-white/85 p-6 ring-soft">
          {sections.map((section) => (
            <article key={section.title} className="space-y-2">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--ink-soft)]">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}

          <article className="space-y-2 border-t border-black/10 pt-4">
            <h2 className="text-lg font-semibold">Contact Support</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              For account or billing support, email{" "}
              <a
                href="mailto:brandennevius@gmail.com"
                className="font-medium text-[color:var(--ocean-dark)] underline underline-offset-4"
              >
                brandennevius@gmail.com
              </a>
              .
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
