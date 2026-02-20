import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { normalizeHexColor, resolveCategoryColor } from "@/lib/categoryColors";

const isTransferCategoryName = (value?: string | null) => {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return false;
  return /(transfer[_\s-]*out|transfer[_\s-]*in|internal[_\s-]*transfer)/i.test(
    key
  );
};

export async function GET() {
  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const categories = await prisma.transaction.findMany({
    where: { userId: client.id, transactionType: "REGULAR" },
    select: { category: true },
    distinct: ["category"],
  });
  const splitCategories = await prisma.transactionSplit.findMany({
    where: { transaction: { userId: client.id, transactionType: "REGULAR" } },
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
        .filter((name) => Boolean(name) && !isTransferCategoryName(name)),
      ...splitCategories
        .map((item) => item.category)
        .filter((name) => Boolean(name) && !isTransferCategoryName(name)),
      ...settings
        .map((item) => item.name)
        .filter((name) => Boolean(name) && !isTransferCategoryName(name)),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const settingsMap = new Map(settings.map((item) => [item.name, item]));
  const formattedSettings = list.map((name) => {
    const existing = settingsMap.get(name);
    return {
      id: existing?.id,
      name,
      color: resolveCategoryColor(name, existing?.color),
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

export async function DELETE(request: Request) {
  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string };
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.transaction.updateMany({
        where: { userId: client.id, category: name },
        data: { category: null, categoryNeedsReview: true, categorySource: "USER" },
      }),
      tx.transactionSplit.updateMany({
        where: { transaction: { userId: client.id }, category: name },
        data: { category: "Uncategorized" },
      }),
      tx.goal.updateMany({
        where: { userId: client.id, category: name },
        data: { category: null },
      }),
      tx.categoryRule.deleteMany({
        where: { userId: client.id, category: name },
      }),
      tx.category.deleteMany({
        where: { userId: client.id, name },
      }),
    ]);

    const groupsWithCategory = await tx.categoryGroup.findMany({
      where: { userId: client.id, categories: { has: name } },
    });
    for (const group of groupsWithCategory) {
      await tx.categoryGroup.update({
        where: { id: group.id },
        data: { categories: group.categories.filter((item) => item !== name) },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    currentName?: string;
    name?: string;
    color?: string | null;
    essential?: boolean;
    monthlyBudget?: number | null;
  };

  const name = String(body?.name ?? "").trim();
  const currentName = String(body?.currentName ?? name).trim();
  if (!name || !currentName) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (isTransferCategoryName(name)) {
    return NextResponse.json(
      { error: "Transfer categories are managed by Internal Transfer transaction type." },
      { status: 400 }
    );
  }

  const monthlyBudget =
    typeof body?.monthlyBudget === "number" && !Number.isNaN(body.monthlyBudget)
      ? body.monthlyBudget
      : null;

  const hasColorInPayload = Object.prototype.hasOwnProperty.call(body ?? {}, "color");
  const normalizedColor = normalizeHexColor(body?.color);
  const updateData: {
    color?: string | null;
    essential: boolean;
    monthlyBudget: number | null;
  } = {
    essential: body?.essential ?? false,
    monthlyBudget,
  };
  if (hasColorInPayload) {
    updateData.color = normalizedColor;
  }

  const category = await prisma.$transaction(async (tx) => {
    const renamed = currentName !== name;

    if (renamed) {
      await Promise.all([
        tx.transaction.updateMany({
          where: { userId: client.id, category: currentName },
          data: { category: name },
        }),
        tx.transactionSplit.updateMany({
          where: { transaction: { userId: client.id }, category: currentName },
          data: { category: name },
        }),
        tx.goal.updateMany({
          where: { userId: client.id, category: currentName },
          data: { category: name },
        }),
        tx.categoryRule.updateMany({
          where: { userId: client.id, category: currentName },
          data: { category: name },
        }),
      ]);

      const groupsWithCategory = await tx.categoryGroup.findMany({
        where: { userId: client.id, categories: { has: currentName } },
      });
      for (const group of groupsWithCategory) {
        const nextCategories = Array.from(
          new Set(group.categories.map((item) => (item === currentName ? name : item)))
        );
        await tx.categoryGroup.update({
          where: { id: group.id },
          data: { categories: nextCategories },
        });
      }
    }

    const upserted = await tx.category.upsert({
      where: { userId_name: { userId: client.id, name } },
      update: updateData,
      create: {
        userId: client.id,
        name,
        color: normalizedColor,
        essential: body?.essential ?? false,
        monthlyBudget,
      },
    });

    if (renamed) {
      await tx.category.deleteMany({
        where: { userId: client.id, name: currentName },
      });
    }

    return upserted;
  });

  return NextResponse.json({ category });
}
