"use client";

import { useMemo } from "react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

type CategoryRow = {
  name: string;
  value: number;
};

type Props = {
  clientName: string;
  rangeLabel: string;
  incomeTotal: number;
  spendTotal: number;
  savings: number;
  categories: CategoryRow[];
};

type SankeyNode = {
  id: string;
  label: string;
  value: number;
  column: number;
  color: string;
};

type SankeyLink = {
  source: string;
  target: string;
  value: number;
  color: string;
};

type LayoutNode = SankeyNode & {
  x: number;
  y: number;
  height: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const palette = [
  "#1d4ed8",
  "#0ea5e9",
  "#0f766e",
  "#16a34a",
  "#f59e0b",
  "#f97316",
  "#db2777",
  "#7c3aed",
];

export default function DistributionClient({
  clientName,
  rangeLabel,
  incomeTotal,
  spendTotal,
  savings,
  categories,
}: Props) {
  const sankey = useMemo(() => {
    const nodes: SankeyNode[] = [];
    const links: SankeyLink[] = [];

    if (incomeTotal > 0) {
      nodes.push({
        id: "income",
        label: "Income",
        value: incomeTotal,
        column: 0,
        color: "#0c7a7a",
      });
    }

    if (spendTotal > 0) {
      nodes.push({
        id: "spending",
        label: "Spending",
        value: spendTotal,
        column: 1,
        color: "#d97706",
      });
    }

    if (savings > 0) {
      nodes.push({
        id: "savings",
        label: "Savings",
        value: savings,
        column: 1,
        color: "#16a34a",
      });
    }

    categories.forEach((category, index) => {
      nodes.push({
        id: `category-${category.name}`,
        label: category.name,
        value: category.value,
        column: 2,
        color: palette[index % palette.length],
      });
    });

    if (incomeTotal > 0 && spendTotal > 0) {
      links.push({
        source: "income",
        target: "spending",
        value: spendTotal,
        color: "rgba(12, 122, 122, 0.35)",
      });
    }

    if (incomeTotal > 0 && savings > 0) {
      links.push({
        source: "income",
        target: "savings",
        value: savings,
        color: "rgba(22, 163, 74, 0.28)",
      });
    }

    if (spendTotal > 0) {
      categories.forEach((category, index) => {
        links.push({
          source: "spending",
          target: `category-${category.name}`,
          value: category.value,
          color: `rgba(15, 118, 110, ${0.15 + index * 0.06})`,
        });
      });
    }

    return { nodes, links };
  }, [incomeTotal, spendTotal, savings, categories]);

  const chart = useMemo(() => {
    const width = 980;
    const height = 460;
    const nodeWidth = 18;
    const columnX = [40, 360, 680];
    const padding = 18;
    const topBottom = 40;

    const columns = [0, 1, 2];
    const columnNodes = columns.map((column) =>
      sankey.nodes.filter((node) => node.column === column)
    );

    const columnTotals = columnNodes.map((nodes) =>
      nodes.reduce((acc, node) => acc + node.value, 0)
    );
    const maxColumnTotal = Math.max(1, ...columnTotals);
    const maxNodeCount = Math.max(1, ...columnNodes.map((nodes) => nodes.length));

    const scale =
      (height - topBottom * 2 - padding * (maxNodeCount - 1)) /
      maxColumnTotal;

    const layoutNodes: LayoutNode[] = [];

    columnNodes.forEach((nodes, columnIndex) => {
      const sorted = [...nodes].sort((a, b) => b.value - a.value);
      const totalHeight =
        sorted.reduce((acc, node) => acc + node.value * scale, 0) +
        padding * (sorted.length - 1);
      let cursor = (height - totalHeight) / 2;

      sorted.forEach((node) => {
        const nodeHeight = Math.max(4, node.value * scale);
        layoutNodes.push({
          ...node,
          x: columnX[columnIndex],
          y: cursor,
          height: nodeHeight,
        });
        cursor += nodeHeight + padding;
      });
    });

    const nodeMap = new Map(layoutNodes.map((node) => [node.id, node]));
    const outgoing = new Map<string, number>();
    const incoming = new Map<string, number>();

    const layoutLinks = sankey.links.map((link) => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) {
        return null;
      }

      const thickness = Math.max(1, link.value * scale);
      const sourceOffset = outgoing.get(source.id) ?? 0;
      const targetOffset = incoming.get(target.id) ?? 0;

      const sourceY = source.y + sourceOffset + thickness / 2;
      const targetY = target.y + targetOffset + thickness / 2;

      outgoing.set(source.id, sourceOffset + thickness);
      incoming.set(target.id, targetOffset + thickness);

      const startX = source.x + nodeWidth;
      const endX = target.x;
      const dx = (endX - startX) * 0.5;

      const path = `M ${startX} ${sourceY} C ${startX + dx} ${sourceY}, ${
        endX - dx
      } ${targetY}, ${endX} ${targetY}`;

      return {
        id: `${link.source}-${link.target}`,
        path,
        thickness,
        color: link.color,
      };
    });

    return {
      width,
      height,
      nodeWidth,
      nodes: layoutNodes,
      links: layoutLinks.filter(Boolean) as Array<{
        id: string;
        path: string;
        thickness: number;
        color: string;
      }>,
    };
  }, [sankey]);

  const hasData = incomeTotal > 0 || spendTotal > 0;

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[color:var(--ink)]">
      <div className="pointer-events-none absolute left-[-140px] top-[6%] h-[360px] w-[360px] rounded-full bg-emerald-100/60 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[14%] h-[320px] w-[320px] rounded-full bg-amber-100/60 blur-[120px]" />

      <div className="flex w-full gap-5 px-3 pb-24 pt-8 md:px-4 lg:px-6 2xl:px-8">
        <aside className="hidden w-56 shrink-0 flex-col gap-5 xl:flex">
          <div className="rounded-3xl bg-white/80 p-4 ring-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--ocean)] text-white">
                A
              </div>
              <div>
                <p className="text-sm font-semibold">Arbor</p>
                <p className="text-xs text-[color:var(--ink-soft)]">Client view</p>
              </div>
            </div>
          </div>
          <nav className="space-y-2 rounded-3xl bg-white/80 p-4 ring-soft">
            {[
              { label: "Dashboard", href: "/client" },
              { label: "Distribution", href: "/distribution", active: true },
              { label: "Transactions", href: "/transactions" },
              { label: "Goals", href: "/goals" },
              { label: "Cash flow", href: "#", disabled: true },
              { label: "Accounts", href: "/accounts" },
              { label: "Investments", href: "#", disabled: true },
              { label: "Categories", href: "/categories" },
              { label: "Recurrings", href: "#", disabled: true },
              { label: "Settings", href: "/settings" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm ${
                  item.disabled
                    ? "cursor-not-allowed text-[color:var(--ink-soft)]/60"
                    : item.active
                    ? "bg-white/70 text-[color:var(--ink)] shadow-sm"
                    : "text-[color:var(--ink-soft)] hover:bg-white/60"
                }`}
              >
                <span>{item.label}</span>
                {item.disabled ? (
                  <span className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                    Soon
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ocean)]">
                Distribution
              </p>
              <h1 className="font-display text-3xl md:text-4xl">
                {clientName}'s flow of funds
              </h1>
              <p className="text-sm text-[color:var(--ink-soft)]">
                {rangeLabel} · Income to spending and savings breakdown.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SignOutButton className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink-soft)]" />
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-[32px] bg-white/85 p-6 ring-soft">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Budget flow</p>
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    Based on linked transactions
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--ink-soft)]">
                  <span className="rounded-full bg-white/70 px-3 py-1 ring-soft">
                    Income {formatCurrency(incomeTotal)}
                  </span>
                  <span className="rounded-full bg-white/70 px-3 py-1 ring-soft">
                    Spend {formatCurrency(spendTotal)}
                  </span>
                  <span className="rounded-full bg-white/70 px-3 py-1 ring-soft">
                    Savings {formatCurrency(savings)}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] bg-white/70 p-4 ring-soft">
                {hasData ? (
                  <svg
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                    className="h-[420px] w-full"
                    role="img"
                    aria-label="Sankey diagram showing distribution of income"
                  >
                    {chart.links.map((link) => (
                      <path
                        key={link.id}
                        d={link.path}
                        fill="none"
                        stroke={link.color}
                        strokeWidth={Math.max(2, link.thickness)}
                        strokeLinecap="round"
                        opacity={0.9}
                      />
                    ))}
                    {chart.nodes.map((node) => (
                      <g key={node.id}>
                        <rect
                          x={node.x}
                          y={node.y}
                          width={chart.nodeWidth}
                          height={node.height}
                          rx={8}
                          fill={node.color}
                        />
                        <text
                          x={
                            node.column === 0
                              ? node.x - 10
                              : node.x + chart.nodeWidth + 10
                          }
                          y={node.y + 6}
                          textAnchor={node.column === 0 ? "end" : "start"}
                          className="fill-[color:var(--ink)] text-[12px] font-semibold"
                        >
                          <tspan>{node.label}</tspan>
                          <tspan
                            x={
                              node.column === 0
                                ? node.x - 10
                                : node.x + chart.nodeWidth + 10
                            }
                            dy="1.2em"
                            className="fill-[color:var(--ink-soft)] text-[11px]"
                          >
                            {formatCurrency(node.value)}
                          </tspan>
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : (
                  <div className="flex h-[420px] items-center justify-center text-sm text-[color:var(--ink-soft)]">
                    Connect accounts to see your distribution flow.
                  </div>
                )}
              </div>
            </div>

            <aside className="flex flex-col gap-4">
              <div className="rounded-[28px] bg-white/85 p-5 ring-soft">
                <p className="text-sm font-semibold">Top destinations</p>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  Largest spending categories this period.
                </p>
                <div className="mt-4 space-y-3">
                  {categories.map((category) => (
                    <div
                      key={category.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{category.name}</span>
                      <span className="text-[color:var(--ink-soft)]">
                        {formatCurrency(category.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] bg-[color:var(--ink)] p-5 text-white">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                  Next move
                </p>
                <p className="mt-2 text-lg font-semibold">
                  Shift the biggest outflow first.
                </p>
                <p className="mt-2 text-sm text-emerald-50/80">
                  Focusing on the top two categories will move the savings needle
                  the fastest.
                </p>
                <button className="mt-5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[color:var(--ink)]">
                  Create a plan
                </button>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
