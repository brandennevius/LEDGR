"use client";

import { useEffect, useState } from "react";
import { categoryColorPalette } from "@/lib/categoryColors";

type CategorySetting = {
  id?: string;
  name: string;
  color: string;
  essential: boolean;
  monthlyBudget: number | null;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function CategorySettingsClient() {
  const [settings, setSettings] = useState<CategorySetting[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(categoryColorPalette[0]);
  const [essential, setEssential] = useState(false);
  const [budget, setBudget] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const loadSettings = async () => {
    const response = await fetch("/api/categories");
    if (!response.ok) return;
    const data = (await response.json()) as { settings?: CategorySetting[] };
    setSettings(data.settings ?? []);
  };

  useEffect(() => {
    loadSettings().catch(() => null);
  }, []);

  const saveSetting = async (payload: {
    name: string;
    color?: string | null;
    essential?: boolean;
    monthlyBudget?: number | null;
  }) => {
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setStatus("Unable to save category settings.");
      return;
    }

    setStatus("Saved.");
    loadSettings().catch(() => null);
    setTimeout(() => setStatus(null), 2000);
  };

  const createCategory = async () => {
    if (!name.trim()) return;
    const monthlyBudget = budget ? Number(budget) : null;
    await saveSetting({
      name: name.trim(),
      color,
      essential,
      monthlyBudget: monthlyBudget && !Number.isNaN(monthlyBudget) ? monthlyBudget : null,
    });
    setName("");
    setColor(categoryColorPalette[0]);
    setEssential(false);
    setBudget("");
  };

  return (
    <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Category settings</p>
          <p className="text-xs text-[color:var(--ink-soft)]">
            Mark essential expenses and assign monthly budgets.
          </p>
        </div>
        {status ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            {status}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_0.6fr_0.6fr_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Category name (e.g., Rent)"
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2">
          {categoryColorPalette.map((item) => (
            <button
              key={item}
              type="button"
              className={`h-5 w-5 rounded-full ring-offset-2 transition ${
                color === item ? "ring-2 ring-[color:var(--ocean)]" : "ring-1 ring-black/10"
              }`}
              style={{ backgroundColor: item }}
              onClick={() => setColor(item)}
              aria-label={`Select ${item} color`}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs text-[color:var(--ink-soft)]">
          <input
            type="checkbox"
            checked={essential}
            onChange={(event) => setEssential(event.target.checked)}
          />
          Essential
        </label>
        <input
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          placeholder="Monthly $"
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
        <button
          onClick={createCategory}
          className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-xs font-semibold text-white"
        >
          Add category
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {settings.length === 0 ? (
          <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
            No category settings yet. Add essential categories and budgets above.
          </div>
        ) : (
          settings.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl bg-white/70 px-4 py-3 ring-soft"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="text-sm font-medium">{item.name}</p>
                  </div>
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    {item.essential ? "Essential" : "Flexible"}
                    {item.monthlyBudget
                      ? ` · Budget ${formatCurrency(item.monthlyBudget)}`
                      : " · No budget"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] text-[color:var(--ink-soft)]">
                    <input
                      type="checkbox"
                      checked={item.essential}
                      onChange={(event) => {
                        const next = settings.map((setting) =>
                          setting.name === item.name
                            ? { ...setting, essential: event.target.checked }
                            : setting
                        );
                        setSettings(next);
                      }}
                    />
                    Essential
                  </label>
                  <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1">
                    {categoryColorPalette.map((colorOption) => (
                      <button
                        key={`${item.name}-${colorOption}`}
                        type="button"
                        onClick={() => {
                          const next = settings.map((setting) =>
                            setting.name === item.name
                              ? { ...setting, color: colorOption }
                              : setting
                          );
                          setSettings(next);
                        }}
                        className={`h-3.5 w-3.5 rounded-full ring-offset-2 ${
                          item.color === colorOption
                            ? "ring-2 ring-[color:var(--ocean)]"
                            : "ring-1 ring-black/10"
                        }`}
                        style={{ backgroundColor: colorOption }}
                        aria-label={`Set ${item.name} color to ${colorOption}`}
                      />
                    ))}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={item.monthlyBudget ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      const next = settings.map((setting) =>
                        setting.name === item.name
                          ? {
                              ...setting,
                              monthlyBudget: value ? Number(value) : null,
                            }
                          : setting
                      );
                      setSettings(next);
                    }}
                    className="w-28 rounded-full border border-black/10 bg-white px-3 py-1 text-[10px]"
                    placeholder="Budget"
                  />
                  <button
                    onClick={() =>
                      saveSetting({
                        name: item.name,
                        color: item.color,
                        essential: item.essential,
                        monthlyBudget: item.monthlyBudget,
                      })
                    }
                    className="rounded-full bg-[color:var(--ocean)] px-3 py-1 text-[10px] font-semibold text-white"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
