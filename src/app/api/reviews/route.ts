import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const approvedOnly = searchParams.get("approved") === "true";
  const client = await getAuthedUser();

  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const review = await prisma.coachReview.findFirst({
    where: {
      clientId: client.id,
      ...(approvedOnly ? { approvedAt: { not: null } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ review });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    highlights?: string[];
    actions?: string[];
    notes?: string;
    publish?: boolean;
  };

  const client = await getAuthedUser();

  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body?.highlights?.length || !body?.actions?.length) {
    return NextResponse.json(
      { error: "Highlights and actions are required." },
      { status: 400 }
    );
  }

  const review = await prisma.coachReview.create({
    data: {
      clientId: client.id,
      coachId: null,
      highlights: body.highlights,
      actions: body.actions,
      notes: body.notes ?? null,
      approvedAt: body.publish === false ? null : new Date(),
    },
  });

  return NextResponse.json({ review });
}
