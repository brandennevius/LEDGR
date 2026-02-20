import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service • LEDGR",
  description: "Terms governing use of LEDGR apps and services.",
};

const updatedAt = "February 20, 2026";

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
          <p className="text-sm text-[color:var(--ink-soft)]">
            These Terms of Service ("Terms") govern your access to and use of LEDGR web and mobile
            applications, APIs, and related services (collectively, the "Services"). By using LEDGR,
            you agree to these Terms.
          </p>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">1) Eligibility and Accounts</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              You must provide accurate account information and keep your login credentials secure.
              You are responsible for activity performed through your account.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">2) Service Scope</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              LEDGR provides budgeting, cash-flow analysis, account aggregation, and coaching tools.
              LEDGR is not a bank, broker, lender, accountant, law firm, or registered investment
              advisor.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">3) Financial Data and Connected Accounts</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              When you connect financial accounts, you authorize LEDGR and service providers (including
              Plaid) to retrieve and process account and transaction data needed to operate the
              Services.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">4) AI Coaching Features</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              AI outputs are informational and may contain errors. You should verify important details
              before acting. AI responses are not legal, tax, accounting, or investment advice.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">5) Acceptable Use</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              You agree not to misuse the Services, attempt unauthorized access, reverse engineer the
              platform, interfere with operations, or use LEDGR for unlawful activity.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">6) Suspension and Termination</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              We may suspend or terminate access if we detect abuse, security risk, legal violations,
              or violations of these Terms.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">7) Disclaimers</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              Services are provided "as is" and "as available" without warranties of uninterrupted
              operation, accuracy, or fitness for a particular purpose.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">8) Limitation of Liability</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              To the maximum extent permitted by law, LEDGR is not liable for indirect, incidental,
              special, consequential, or punitive damages, or loss of profits, data, or goodwill.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">9) Changes to Terms</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              We may update these Terms. Continued use of the Services after updates means you accept
              the revised Terms.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">10) Contact</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              Questions about these Terms: {" "}
              <a
                href="mailto:brandennevius@gmail.com"
                className="font-medium text-[color:var(--ocean-dark)] underline underline-offset-4"
              >
                brandennevius@gmail.com
              </a>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
