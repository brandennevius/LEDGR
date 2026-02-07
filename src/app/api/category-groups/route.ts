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
