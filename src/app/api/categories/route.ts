import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

export async function GET() {
  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const categories = await prisma.transaction.findMany({
    where: { userId: client.id },
    select: { category: true },
    distinct: ["category"],
  });
  const settings = await prisma.category.findMany({
    where: { userId: client.id },
    orderBy: { name: "asc" },
  });
  const groups = await prisma.categoryGroup.findMany({
    where: { userId: client.id },
    orderBy: { name: "asc" },
  });

  const list = Array.from(
    new Set([
      ...categories
        .map((item) => item.category ?? "Uncategorized")
        .filter(Boolean),
      ...settings.map((item) => item.name),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const settingsMap = new Map(settings.map((item) => [item.name, item]));
  const formattedSettings = list.map((name) => {
    const existing = settingsMap.get(name);
    return {
      id: existing?.id,
      name,
      essential: existing?.essential ?? false,
      monthlyBudget: existing?.monthlyBudget ?? null,
    };
  });

  return NextResponse.json({
    categories: list,
    settings: formattedSettings,
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      categories: group.categories,
      unassignedBudget: group.unassignedBudget,
    })),
  });
}

export async function POST(request: Request) {
  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    essential?: boolean;
    monthlyBudget?: number | null;
  };

  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const monthlyBudget =
    typeof body?.monthlyBudget === "number" && !Number.isNaN(body.monthlyBudget)
      ? body.monthlyBudget
      : null;

  const category = await prisma.category.upsert({
    where: { userId_name: { userId: client.id, name } },
    update: {
      essential: body?.essential ?? false,
      monthlyBudget,
    },
    create: {
      userId: client.id,
      name,
      essential: body?.essential ?? false,
      monthlyBudget,
    },
  });

  return NextResponse.json({ category });
}
