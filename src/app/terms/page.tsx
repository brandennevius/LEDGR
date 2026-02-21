import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service • LEDGR",
  description: "Terms governing use of LEDGR web and mobile services.",
};

const updatedAt = "February 21, 2026";

const sections: Array<{ title: string; body: string[] }> = [
  {
    title: "1) Agreement and Scope",
    body: [
      "These Terms of Service govern your use of LEDGR web and mobile applications, APIs, and related services.",
      "By creating an account, connecting financial institutions, or using LEDGR, you agree to these Terms.",
    ],
  },
  {
    title: "2) Eligibility and Account Responsibilities",
    body: [
      "You must be at least 18 years old and legally able to enter this agreement.",
      "You are responsible for account credentials, device security, and actions taken under your account.",
    ],
  },
  {
    title: "3) Service Description",
    body: [
      "LEDGR provides software for transaction review, budgeting, goals, cash-flow analysis, and AI-based coaching.",
      "LEDGR is not a bank, broker, credit union, lender, accounting firm, law firm, or investment advisor.",
    ],
  },
  {
    title: "4) Financial Connections and Third Parties",
    body: [
      "When you link financial accounts, you authorize LEDGR and providers such as Plaid to retrieve account and transaction data needed to operate the product.",
      "Institution connectivity and data availability may vary due to provider or bank-side limitations.",
    ],
  },
  {
    title: "5) Transaction Data, Categories, and Rules",
    body: [
      "LEDGR may auto-classify transactions and suggest categories, transaction types, and related insights.",
      "You remain responsible for reviewing and confirming classifications, internal transfers, and budgeting decisions.",
    ],
  },
  {
    title: "6) AI Coaching Features",
    body: [
      "Penny responses are informational and are generated from your request context and available data.",
      "AI output may be incomplete or incorrect and does not constitute legal, tax, accounting, lending, or investment advice.",
    ],
  },
  {
    title: "7) Acceptable Use",
    body: [
      "You may not misuse the service, attempt unauthorized access, interfere with operations, scrape non-public systems, or use LEDGR for unlawful activity.",
      "We may suspend, restrict, or terminate access for abuse, fraud, security risk, or Terms violations.",
    ],
  },
  {
    title: "8) Availability, Changes, and Beta Features",
    body: [
      "Features, limits, integrations, and user interfaces may change over time, including during beta testing.",
      "We may add, modify, or discontinue features without prior notice where reasonably required for security or operations.",
    ],
  },
  {
    title: "9) Fees and Subscriptions",
    body: [
      "If paid plans are offered, pricing and billing terms will be presented before purchase.",
      "Mobile subscriptions are billed and managed by the platform provider (for example, Apple) under that provider's billing terms.",
    ],
  },
  {
    title: "10) Disclaimers",
    body: [
      "LEDGR is provided \"as is\" and \"as available\" without warranties of uninterrupted availability, complete accuracy, or fitness for a particular purpose.",
      "We do not guarantee uninterrupted institution syncs, transaction freshness, or universal account support.",
    ],
  },
  {
    title: "11) Limitation of Liability",
    body: [
      "To the fullest extent permitted by law, LEDGR is not liable for indirect, incidental, consequential, punitive, or special damages, including loss of profits, data, or goodwill.",
      "Our aggregate liability for claims arising from the service is limited to amounts you paid to LEDGR in the preceding 12 months.",
    ],
  },
  {
    title: "12) Changes to Terms and Contact",
    body: [
      "We may update these Terms and will revise the \"Last updated\" date when changes are published.",
      "If you continue using LEDGR after updates, you accept the revised Terms.",
      "Questions: brandennevius@gmail.com",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">Legal</p>
            <h1 className="font-display text-3xl md:text-4xl">Terms of Service</h1>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">Last updated: {updatedAt}</p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
          >
            Back to home
          </Link>
        </header>

        <section className="space-y-5 rounded-[32px] bg-white/85 p-6 ring-soft">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={`${section.title}-${paragraph}`} className="text-sm text-[color:var(--ink-soft)]">
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
