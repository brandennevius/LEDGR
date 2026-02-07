"use client";

import { useEffect, useState } from "react";

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function SettingsClient() {
  const [overrideValue, setOverrideValue] = useState<string>("");
  const [savedValue, setSavedValue] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");

  const applyTheme = (mode: "system" | "light" | "dark") => {
    if (typeof window === "undefined") return;
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    ).matches;
    const nextTheme =
      mode === "system" ? (prefersDark ? "dark" : "light") : mode;
    document.documentElement.dataset.theme = nextTheme;
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (typeof data.monthlyIncomeOverride === "number") {
          setSavedValue(data.monthlyIncomeOverride);
          setOverrideValue(String(data.monthlyIncomeOverride));
        } else {
          setSavedValue(null);
          setOverrideValue("");
        }
      })
      .catch(() => null);

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("theme");
      if (stored === "light" || stored === "dark" || stored === "system") {
        setTheme(stored);
        applyTheme(stored);
      } else {
        applyTheme("system");
      }
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        const pref = window.localStorage.getItem("theme") ?? "system";
        if (pref === "system") {
          applyTheme("system");
        }
      };
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    const value = overrideValue.trim();
    const payload =
      value.length > 0 && !Number.isNaN(Number(value))
        ? Number(value)
        : null;

    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyIncomeOverride: payload }),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        monthlyIncomeOverride?: number | null;
      };
      setSavedValue(data.monthlyIncomeOverride ?? null);
      setStatus("Saved.");
    } else {
      setStatus("Unable to save. Try again.");
    }
    setSaving(false);
  };

  const handleClear = async () => {
    setOverrideValue("");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyIncomeOverride: null }),
    });
    setSavedValue(null);
    setStatus("Reverted to detected income.");
  };

  const handleThemeChange = (value: "system" | "light" | "dark") => {
    setTheme(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", value);
    }
    applyTheme(value);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] bg-white/85 p-6 ring-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Appearance</p>
            <p className="text-xs text-[color:var(--ink-soft)]">
              Choose a theme for the dashboard.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {(["system", "light", "dark"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleThemeChange(option)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                theme === option
                  ? "bg-[color:var(--ocean)] text-white shadow-lg shadow-black/10"
                  : "border border-black/10 bg-white text-[color:var(--ink-soft)]"
              }`}
            >
              {option === "system"
                ? "System"
                : option === "light"
                ? "Light"
                : "Dark"}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] bg-white/85 p-6 ring-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Income override</p>
            <p className="text-xs text-[color:var(--ink-soft)]">
              Use this to override the monthly income forecast when your deposits
              are irregular.
            </p>
          </div>
          {savedValue !== null && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Current override {formatCurrency(savedValue)}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min="0"
            step="10"
            value={overrideValue}
            onChange={(event) => setOverrideValue(event.target.value)}
            placeholder="e.g. 4500"
            className="w-full max-w-xs rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink)]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save override"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]"
          >
            Use detected income
          </button>
        </div>
        {status ? (
          <p className="mt-3 text-xs text-[color:var(--ink-soft)]">{status}</p>
        ) : null}
      </section>
    </div>
  );
}
