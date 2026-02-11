"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-emerald-200 focus:ring-2 focus:ring-emerald-100";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/client";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setLoading(true);

    const redirectTo = `${window.location.origin}/auth/callback`;

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setStatus("Check your email to confirm your account.");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        router.push(nextPath);
      }
    }

    setLoading(false);
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setError(null);
    setStatus(null);
    setLoading(true);

    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 md:px-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 rounded-[36px] border border-white/60 bg-white/60 p-8 shadow-[0_20px_60px_-40px_rgba(11,30,35,0.6)] md:flex-row md:items-center md:p-12">
        <div className="flex-1 space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
            LEDGR coaching platform
          </p>
          <h1 className="font-display text-4xl text-[color:var(--ink)] md:text-5xl">
            Sign in to keep your goals on track.
          </h1>
          <p className="text-sm text-[color:var(--ink-soft)] md:text-base">
            Access your coaching dashboard, linked accounts, and AI insights. Your
            financial story stays private and coach-reviewed.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="rounded-full border border-white/70 bg-white px-5 py-2 text-sm font-semibold text-[color:var(--ink)] shadow-sm transition hover:-translate-y-0.5"
              disabled={loading}
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              className="rounded-full border border-white/70 bg-white px-5 py-2 text-sm font-semibold text-[color:var(--ink)] shadow-sm transition hover:-translate-y-0.5"
              disabled={loading}
            >
              Continue with Apple
            </button>
          </div>
        </div>

        <div className="w-full max-w-md rounded-[28px] bg-white/80 p-6 ring-soft">
          <div className="mb-6 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-full px-4 py-2 font-semibold transition ${
                mode === "signin"
                  ? "bg-[color:var(--ocean)] text-white"
                  : "text-[color:var(--ink-soft)] hover:bg-white"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-full px-4 py-2 font-semibold transition ${
                mode === "signup"
                  ? "bg-[color:var(--ocean)] text-white"
                  : "text-[color:var(--ink-soft)] hover:bg-white"
              }`}
            >
              Create account
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleEmailAuth}>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
              placeholder="you@domain.com"
              required
            />
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClassName}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
            />

            {error ? (
              <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            ) : null}
            {status ? (
              <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {status}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-full bg-[color:var(--ink)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
              disabled={loading}
            >
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
