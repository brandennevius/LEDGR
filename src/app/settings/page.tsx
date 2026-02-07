import Link from "next/link";
import { requireAuthedUser } from "@/lib/auth";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAuthedUser();

  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[6%] h-[360px] w-[360px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[14%] h-[320px] w-[320px] rounded-full bg-amber-100/60 blur-[120px]" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Settings
            </p>
            <h1 className="font-display text-3xl md:text-4xl">
              Personalize your income forecast.
            </h1>
            <p className="text-sm text-[color:var(--ink-soft)]">
              Override monthly income when your deposits are irregular.
            </p>
          </div>
          <Link
            href="/client"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
          >
            Back to dashboard
          </Link>
        </header>

        <SettingsClient />
      </main>
    </div>
  );
}
