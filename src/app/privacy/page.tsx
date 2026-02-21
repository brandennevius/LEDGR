import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy • LEDGR",
  description: "How LEDGR collects, uses, shares, and protects user data.",
};

const updatedAt = "February 21, 2026";

const sections: Array<{ title: string; body: string[] }> = [
  {
    title: "1) What We Collect",
    body: [
      "Account data: email, auth identifiers, and profile metadata needed for sign-in and account management.",
      "Financial data: accounts, balances, transactions, liabilities, and investment-related fields retrieved through connected providers like Plaid.",
      "Product data: categories, transaction edits, rules, goals, review state, and in-app configuration.",
      "Support data: information you share when contacting support.",
    ],
  },
  {
    title: "2) Why We Process Data",
    body: [
      "To provide core features including account sync, dashboards, budgeting, goal tracking, and reporting.",
      "To secure the platform, prevent abuse, and troubleshoot reliability issues.",
      "To generate AI-powered responses and coaching insights based on your requests.",
    ],
  },
  {
    title: "3) AI Processing and Prompt Context",
    body: [
      "LEDGR uses a minimization layer that prefers aggregated and de-identified financial context for most AI requests.",
      "Transaction-level details are sent only when needed to answer a specific user prompt.",
      "We do not sell personal data or AI prompt data.",
    ],
  },
  {
    title: "4) Service Providers and Sharing",
    body: [
      "We share data only with processors needed to operate LEDGR, including Supabase (authentication/database), Plaid (financial aggregation), and OpenAI (AI responses).",
      "We may disclose information when required by law, to enforce rights, or to protect users and service security.",
    ],
  },
  {
    title: "5) Security Controls",
    body: [
      "Data in transit is encrypted using TLS.",
      "Access is controlled by authenticated APIs, environment-scoped credentials, and server-side authorization checks.",
      "We apply monitoring and abuse controls (including rate limiting) to protect the platform.",
    ],
  },
  {
    title: "6) Data Retention",
    body: [
      "We retain data while your account is active and for as long as needed for security, legal, or operational obligations.",
      "Retention periods may vary by data type and legal requirements.",
    ],
  },
  {
    title: "7) Your Rights and Choices",
    body: [
      "You can disconnect linked institutions, update transaction/category data, and export transactions from settings.",
      "You can request access, correction, or deletion by contacting support.",
    ],
  },
  {
    title: "8) Account Deletion",
    body: [
      "When account deletion is requested and confirmed, LEDGR removes active-account data from live systems except data required for legal, security, or fraud-prevention records.",
      "Third-party providers may retain records in accordance with their own legal and compliance obligations.",
    ],
  },
  {
    title: "9) Children",
    body: [
      "LEDGR is not directed to children under 13 and we do not knowingly collect personal data from children under 13.",
    ],
  },
  {
    title: "10) International Transfers",
    body: [
      "Our processors may store or process data in multiple regions where they operate.",
      "By using LEDGR, you acknowledge cross-border processing required to operate the service.",
    ],
  },
  {
    title: "11) Policy Updates",
    body: [
      "We may update this Privacy Policy from time to time and will revise the \"Last updated\" date when changes are published.",
    ],
  },
  {
    title: "12) Contact",
    body: [
      "Privacy requests and questions: brandennevius@gmail.com",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">Legal</p>
            <h1 className="font-display text-3xl md:text-4xl">Privacy Policy</h1>
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
