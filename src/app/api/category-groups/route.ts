import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

export async function GET() {
  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groups = await prisma.categoryGroup.findMany({
    where: { userId: client.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    categories?: string[];
    unassignedBudget?: number;
  };

  if (!body?.name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const group = await prisma.categoryGroup.create({
    data: {
      userId: client.id,
      name: body.name,
      categories: body.categories ?? [],
      unassignedBudget: body.unassignedBudget ?? null,
    },
  });

  return NextResponse.json({ group });
}

export async function PATCH(request: Request) {
  const client = await getAuthedUser();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    groupId?: string | null;
    categoryName?: string;
  };

  const categoryName = String(body?.categoryName ?? "").trim();
  if (!categoryName) {
    return NextResponse.json(
      { error: "categoryName is required." },
      { status: 400 }
    );
  }

  const targetGroupId = body?.groupId ?? null;
  if (targetGroupId) {
    const targetGroup = await prisma.categoryGroup.findFirst({
      where: { id: targetGroupId, userId: client.id },
      select: { id: true },
    });
    if (!targetGroup) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }
  }

  const groups = await prisma.categoryGroup.findMany({
    where: { userId: client.id },
  });

  await Promise.all(
    groups.map((group) => {
      const withoutCategory = group.categories.filter(
        (name) => name !== categoryName
      );
      const nextCategories =
        targetGroupId && group.id === targetGroupId
          ? Array.from(new Set([...withoutCategory, categoryName]))
          : withoutCategory;

      const changed =
        nextCategories.length !== group.categories.length ||
        nextCategories.some((name, index) => name !== group.categories[index]);

      if (!changed) return Promise.resolve(null);
      return prisma.categoryGroup.update({
        where: { id: group.id },
        data: { categories: nextCategories },
      });
    })
  );

  return NextResponse.json({ ok: true });
}
