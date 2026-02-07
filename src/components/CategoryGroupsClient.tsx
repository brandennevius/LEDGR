"use client";

import { useEffect, useState } from "react";

type Group = {
  id: string;
  name: string;
  categories: string[];
  unassignedBudget?: number | null;
};

export default function CategoryGroupsClient() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [categories, setCategories] = useState("");
  const [budget, setBudget] = useState("");

  const loadGroups = async () => {
    const response = await fetch("/api/category-groups");
    const data = await response.json();
    setGroups(data.groups ?? []);
  };

  useEffect(() => {
    loadGroups().catch(() => null);
  }, []);

  const createGroup = async () => {
    if (!name.trim()) return;
    await fetch("/api/category-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        categories: categories
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        unassignedBudget: budget ? Number(budget) : undefined,
      }),
    });
    setName("");
    setCategories("");
    setBudget("");
    loadGroups().catch(() => null);
  };

  return (
    <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Category groups</p>
          <p className="text-xs text-[color:var(--ink-soft)]">
            Organize categories into groups (Copilot style).
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1.2fr_0.6fr_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Group name (e.g., Essentials)"
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
        <input
          value={categories}
          onChange={(event) => setCategories(event.target.value)}
          placeholder="Categories (comma-separated)"
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
        <input
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          placeholder="Unassigned $"
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
        <button
          onClick={createGroup}
          className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-xs font-semibold text-white"
        >
          Add group
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {groups.length === 0 ? (
          <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[color:var(--ink-soft)] ring-soft">
            No groups yet. Add your first group above.
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className="rounded-2xl bg-white/70 px-4 py-3 ring-soft"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{group.name}</p>
                {group.unassignedBudget ? (
                  <span className="text-xs text-[color:var(--ink-soft)]">
                    Unassigned ${group.unassignedBudget}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                {group.categories.length
                  ? group.categories.join(", ")
                  : "No categories assigned."}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
