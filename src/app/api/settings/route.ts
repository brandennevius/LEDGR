import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    monthlyIncomeOverride: user.monthlyIncomeOverride ?? null,
  });
}

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    monthlyIncomeOverride?: number | null;
  };

  const value =
    typeof body.monthlyIncomeOverride === "number"
      ? Math.max(0, body.monthlyIncomeOverride)
      : null;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { monthlyIncomeOverride: value },
  });

  return NextResponse.json({
    monthlyIncomeOverride: updated.monthlyIncomeOverride ?? null,
  });
}
