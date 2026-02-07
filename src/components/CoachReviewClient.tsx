"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ClientSnapshot } from "@/utils/trends";

type Review = {
  highlights: string[];
  actions: string[];
  notes?: string | null;
  approvedAt?: string | null;
};

type Props = {
  clientName: string;
  snapshot: ClientSnapshot;
  review?: Review | null;
};

const emptyLines = (items: string[], target = 3) => {
  const copy = [...items];
  while (copy.length < target) copy.push("");
  return copy;
};

export default function CoachReviewClient({ clientName, snapshot, review }: Props) {
  const initialHighlights = review?.highlights?.length
    ? review.highlights
    : snapshot.aiHighlights;
  const initialActions = review?.actions?.length ? review.actions : snapshot.aiActions;

  const [highlights, setHighlights] = useState<string[]>(
    emptyLines(initialHighlights)
  );
  const [actions, setActions] = useState<string[]>(emptyLines(initialActions));
  const [notes, setNotes] = useState(review?.notes ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(
    review?.approvedAt ?? null
  );
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!review) {
      generateSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHighlightChange = (index: number, value: string) => {
    setHighlights((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleActionChange = (index: number, value: string) => {
    setActions((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const generateSummary = async () => {
    setStatus("Generating AI summary...");
    const response = await fetch("/api/insights/summary", { method: "POST" });
    const data = await response.json();
    if (data?.highlights?.length) {
      setHighlights(emptyLines(data.highlights));
    }
    if (data?.actions?.length) {
      setActions(emptyLines(data.actions));
    }
    if (data?.summary) {
      setNotes(data.summary);
    }
    setStatus(data?.source === "openai" ? "AI summary ready." : "Fallback summary ready.");
  };

  const publishReview = async () => {
    setStatus("Publishing...");
    const trimmedHighlights = highlights.map((item) => item.trim()).filter(Boolean);
    const trimmedActions = actions.map((item) => item.trim()).filter(Boolean);

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        highlights: trimmedHighlights,
        actions: trimmedActions,
        notes: notes.trim(),
        publish: true,
      }),
    });

    const data = await response.json();
    setSavedAt(data?.review?.approvedAt ?? new Date().toISOString());
    setStatus("Published to client.");
  };

  const resetReview = () => {
    setHighlights(emptyLines(snapshot.aiHighlights));
    setActions(emptyLines(snapshot.aiActions));
    setNotes("");
    setSavedAt(null);
    setStatus("Reset to AI draft.");
  };

  const statusLabel = useMemo(() => {
    if (status) return status;
    if (savedAt) return `Published ${new Date(savedAt).toLocaleString()}`;
    return "Draft";
  }, [status, savedAt]);

  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[6%] h-[360px] w-[360px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[14%] h-[320px] w-[320px] rounded-full bg-amber-100/60 blur-[120px]" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
              Coach review
            </p>
            <h1 className="font-display text-3xl md:text-4xl">
              Review {clientName}'s cycle summary.
            </h1>
            <p className="text-sm text-[color:var(--ink-soft)]">
              Cycle 06 · AI-drafted · Edit and publish to client
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
            >
              Back to coach view
            </Link>
            <Link
              href="/client"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
            >
              Client view
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass rounded-[32px] p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                Review summary
              </p>
              <span className="text-xs text-emerald-700">{statusLabel}</span>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                <p className="text-sm font-medium">Highlights</p>
                <div className="mt-3 space-y-3">
                  {highlights.map((item, index) => (
                    <input
                      key={`highlight-${index}`}
                      value={item}
                      onChange={(event) =>
                        handleHighlightChange(index, event.target.value)
                      }
                      placeholder={`Insight ${index + 1}`}
                      className="w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                <p className="text-sm font-medium">Recommended actions</p>
                <div className="mt-3 space-y-3">
                  {actions.map((item, index) => (
                    <input
                      key={`action-${index}`}
                      value={item}
                      onChange={(event) =>
                        handleActionChange(index, event.target.value)
                      }
                      placeholder={`Action ${index + 1}`}
                      className="w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 ring-soft">
                <p className="text-sm font-medium">Coach notes</p>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add context, encouragement, or reminders."
                  className="mt-3 min-h-[120px] w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={publishReview}
                className="rounded-full bg-[color:var(--ocean)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20"
              >
                Publish to client
              </button>
              <button
                onClick={generateSummary}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
              >
                Refresh AI summary
              </button>
              <button
                onClick={resetReview}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
              >
                Reset to rules
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass rounded-[32px] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                Trend snapshot
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <MetricCard
                  title="Spending volatility"
                  value={snapshot.volatilityLabel}
                  detail={`${snapshot.volatility.toFixed(1)} std dev`}
                />
                <MetricCard
                  title="Buffer days"
                  value={snapshot.bufferDays.toFixed(1)}
                  detail={`$${snapshot.cashOnHand.toLocaleString()} on hand`}
                />
                <MetricCard
                  title="Total spend"
                  value={`$${snapshot.totalCurrent.toLocaleString()}`}
                  detail={`${snapshot.totalChangePct >= 0 ? "+" : ""}${snapshot.totalChangePct.toFixed(
                    1
                  )}% vs last cycle`}
                />
                <MetricCard
                  title="Late-night dining"
                  value={`${snapshot.lateNightDining} events`}
                  detail="After 9pm"
                />
              </div>
            </div>
            <div className="rounded-[32px] bg-[color:var(--ink)] p-6 text-white">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                Coach focus
              </p>
              <p className="mt-2 text-lg font-semibold">
                Keep the momentum and trim subscription creep.
              </p>
              <p className="mt-2 text-sm text-emerald-50/80">
                Client is stabilizing spending but needs a stronger buffer rule
                for weekends. Recommend a mid-cycle check-in if volatility rises.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl bg-white/80 p-4 ring-soft">
      <p className="text-xs text-[color:var(--ink-soft)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-emerald-700">{detail}</p>
    </div>
  );
}
