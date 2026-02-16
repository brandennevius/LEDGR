"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-emerald-200 focus:ring-2 focus:ring-emerald-100";

const getSafeNextPath = (value: string | null) =>
  value && value.startsWith("/") ? value : "/client";

const normalizeMfaError = (message: string) => {
  if (message.includes("missing sub claim")) {
    return "Your session is invalid for MFA setup. Sign out, sign in again, then retry.";
  }
  return message;
};

export default function MfaSetupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ensureSession = async () => {
    const [{ data: sessionData }, { data: userData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);
    const hasSession = Boolean(sessionData.session?.access_token);
    const hasUser = Boolean(userData.user);
    return hasSession && hasUser;
  };

  const startEnrollment = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);

    const hasSession = await ensureSession();
    if (!hasSession) {
      setError("Your session has expired. Please sign in again.");
      setLoading(false);
      router.replace(`/login?next=${encodeURIComponent(`/mfa/setup?next=${nextPath}`)}`);
      return;
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "LEDGR Authenticator",
    });

    if (enrollError) {
      setError(normalizeMfaError(enrollError.message));
      setLoading(false);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setStatus("Scan the QR code in your authenticator app, then enter the 6-digit code.");
    setLoading(false);
  };

  const verifyEnrollment = async () => {
    if (!factorId || !code.trim()) return;
    setLoading(true);
    setError(null);
    setStatus(null);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });

    if (verifyError) {
      setError(normalizeMfaError(verifyError.message));
      setLoading(false);
      return;
    }

    router.replace(nextPath);
  };

  return (
    <div className="min-h-screen px-6 py-12 md:px-12">
      <div className="mx-auto w-full max-w-2xl rounded-[36px] border border-white/60 bg-white/60 p-8 shadow-[0_20px_60px_-40px_rgba(11,30,35,0.6)]">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
          Multi-factor setup
        </p>
        <h1 className="mt-3 font-display text-3xl text-[color:var(--ink)] md:text-4xl">
          Add an authenticator app
        </h1>
        <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
          Required for account access. Use Google Authenticator, 1Password, or any TOTP app.
        </p>

        {!factorId ? (
          <button
            type="button"
            onClick={startEnrollment}
            disabled={loading}
            className="mt-6 rounded-full bg-[color:var(--ink)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate QR code"}
          </button>
        ) : (
          <div className="mt-6 space-y-4">
            {qrCode ? (
              <div className="rounded-2xl border border-white/70 bg-white p-4">
                <img src={qrCode} alt="MFA QR code" className="h-56 w-56" />
              </div>
            ) : null}
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
              onClick={verifyEnrollment}
              disabled={loading}
              className="rounded-full bg-[color:var(--ocean)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify and continue"}
            </button>
          </div>
        )}

        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}
        {status ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {status}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3 text-sm">
          <Link href="/auth/signout" className="text-[color:var(--ink-soft)] underline">
            Sign out
          </Link>
          <span className="text-[color:var(--ink-soft)]">·</span>
          <Link href="/login" className="text-[color:var(--ink-soft)] underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
