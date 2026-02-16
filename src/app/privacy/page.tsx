import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy • LEDGR",
  description: "How LEDGR collects, uses, and protects personal data.",
};

const updatedAt = "February 15, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[8%] h-[320px] w-[320px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-120px] top-[14%] h-[300px] w-[300px] rounded-full bg-amber-100/60 blur-[110px]" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Legal
            </p>
            <h1 className="font-display text-3xl md:text-4xl">Privacy Policy</h1>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
              Last updated: {updatedAt}
            </p>
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
            LEDGR (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides budgeting and financial coaching
            tools. This policy explains what data we collect, how we use it, how
            we share it, and your choices.
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">1) Data We Collect</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-[color:var(--ink-soft)]">
              <li>
                Account and authentication data you provide directly, such as name,
                email address, and account credentials through our auth provider.
              </li>
              <li>
                Financial data from Plaid with your consent, including linked
                account details, balances, transactions, liabilities, and
                investment data.
              </li>
              <li>
                App activity and settings data, including categories, goals,
                overrides, and interaction history.
              </li>
              <li>
                Support and communication data when you contact us.
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">2) How We Use Data</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-[color:var(--ink-soft)]">
              <li>Provide account linking, financial dashboards, and coaching insights.</li>
              <li>Power AI-generated summaries and recommendations in the app.</li>
              <li>Secure the platform, detect abuse, and maintain reliability.</li>
              <li>Respond to support requests and communicate service updates.</li>
              <li>Comply with legal and regulatory obligations.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">3) How We Share Data</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              We do not sell your personal data. We share data only with service
              providers needed to operate LEDGR, such as:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-[color:var(--ink-soft)]">
              <li>Plaid for financial account linking and data access.</li>
              <li>Supabase for authentication and managed database services.</li>
              <li>OpenAI for AI analysis features used in the product.</li>
            </ul>
            <p className="text-sm text-[color:var(--ink-soft)]">
              We may also disclose data when required by law or to protect rights,
              safety, and security.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">4) Retention and Deletion</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              We retain data for as long as needed to provide the service,
              maintain security records, and satisfy legal obligations. You can
              request deletion of your account data by contacting us at the email
              below.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">5) Security</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              We use administrative, technical, and organizational controls to
              protect data, including TLS for data in transit and managed
              infrastructure safeguards for data at rest.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">6) Your Choices</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-[color:var(--ink-soft)]">
              <li>Disconnect linked financial accounts through the app.</li>
              <li>Request access, correction, or deletion of your data.</li>
              <li>Stop using the service at any time.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">7) Children</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              LEDGR is not directed to children under 13, and we do not knowingly
              collect personal data from children under 13.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">8) Changes to This Policy</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              We may update this policy from time to time. We will post the
              updated version on this page with a revised &quot;Last updated&quot; date.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">9) Contact</h2>
            <p className="text-sm text-[color:var(--ink-soft)]">
              Privacy requests and questions:{" "}
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
