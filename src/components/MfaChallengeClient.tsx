"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const inputClassName =
  "w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-emerald-200 focus:ring-2 focus:ring-emerald-100";

const getSafeNextPath = (value: string | null) =>
  value && value.startsWith("/") ? value : "/client";

const normalizeMfaError = (message: string) => {
  if (message.includes("missing sub claim")) {
    return "Your session is invalid for MFA challenge. Sign out, sign in again, then retry.";
  }
  return message;
};

export default function MfaChallengeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadFactors = async () => {
      const response = await fetch("/api/mfa/factors");
      const payload = (await response.json()) as {
        factorId?: string | null;
        hasFactor?: boolean;
        error?: string;
      };

      if (!mounted) return;

      if (!response.ok) {
        setError(normalizeMfaError(payload.error ?? "Unable to load MFA factors."));
        return;
      }

      if (!payload.hasFactor || !payload.factorId) {
        router.replace(`/mfa/setup?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      setFactorId(payload.factorId);
    };

    loadFactors().catch(() => {
      if (!mounted) return;
      setError("Unable to load MFA factors.");
    });

    return () => {
      mounted = false;
    };
  }, [nextPath, router]);

  const verifyCode = async () => {
    if (!factorId || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, code: code.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(normalizeMfaError(payload.error ?? "Unable to verify MFA code."));
        return;
      }
      router.replace(nextPath);
    } catch {
      setError("Unable to verify MFA code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 md:px-12">
      <div className="mx-auto w-full max-w-2xl rounded-[36px] border border-white/60 bg-white/60 p-8 shadow-[0_20px_60px_-40px_rgba(11,30,35,0.6)]">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
          Multi-factor challenge
        </p>
        <h1 className="mt-3 font-display text-3xl text-[color:var(--ink)] md:text-4xl">
          Enter your authenticator code
        </h1>
        <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
          Use your 6-digit code to finish sign-in.
        </p>

        <div className="mt-6 space-y-4">
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={inputClassName}
            placeholder="6-digit code"
            inputMode="numeric"
            maxLength={6}
          />
          <button
            type="button"
            onClick={verifyCode}
            disabled={loading || !factorId}
            className="rounded-full bg-[color:var(--ocean)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify and continue"}
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3 text-sm">
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="text-[color:var(--ink-soft)] underline"
          >
            Sign in again
          </Link>
          <span className="text-[color:var(--ink-soft)]">·</span>
          <Link href="/mfa/setup" className="text-[color:var(--ink-soft)] underline">
            Set up a new factor
          </Link>
          <span className="text-[color:var(--ink-soft)]">·</span>
          <Link href="/auth/signout" className="text-[color:var(--ink-soft)] underline">
            Sign out
          </Link>
        </div>
      </div>
    </div>
  );
}
