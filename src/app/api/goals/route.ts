import { NextResponse } from "next/server";
import { GoalCadence, GoalType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { computeCashOnHand, computeGoalCurrent } from "@/lib/goals";
import { buildClientSnapshot } from "@/utils/trends";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [goals, accounts, transactions] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({ where: { userId: user.id } }),
  ]);

  const cashOnHand = computeCashOnHand(accounts);
  const snapshot = buildClientSnapshot({
    asOf: new Date(),
    transactions: transactions.map((tx) => ({
      amount: tx.amount,
      date: tx.date,
      category: tx.category,
    })),
    cashOnHand,
    spendIsPositive: true,
  });

  const hydrated = goals.map((goal) => ({
    ...goal,
    current: computeGoalCurrent({
      goal,
      transactions,
      accounts,
      bufferDays: snapshot.bufferDays,
      cashOnHand,
    }),
  }));

  return NextResponse.json({ goals: hydrated });
}

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const type = String(body?.type ?? GoalType.SAVINGS);
  const cadence = String(body?.cadence ?? GoalCadence.MONTHLY);
  let target = Number(body?.target ?? 0);
  const category = body?.category ? String(body.category) : null;
  const accountId = body?.accountId ? String(body.accountId) : null;
  const minPayment = body?.minPayment ? Number(body.minPayment) : null;
  const priority = body?.priority ? Number(body.priority) : null;
  const status = body?.status ? String(body.status) : "ACTIVE";
  const interestRate = body?.interestRate !== undefined && body?.interestRate !== null
    ? Number(body.interestRate)
    : null;
  const termMonths = body?.termMonths !== undefined && body?.termMonths !== null
    ? Number(body.termMonths)
    : null;
  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const startDate = parseDate(body?.startDate);
  const endDate = parseDate(body?.endDate);

  if (!name) {
    return NextResponse.json({ error: "Invalid goal details." }, { status: 400 });
  }

  if (accountId && type !== GoalType.DEBT) {
    return NextResponse.json(
      { error: "Account selection is only supported for debt goals." },
      { status: 400 }
    );
  }

  if (minPayment !== null && (Number.isNaN(minPayment) || minPayment < 0)) {
    return NextResponse.json(
      { error: "Minimum payment must be a positive number." },
      { status: 400 }
    );
  }

  if (interestRate !== null && (Number.isNaN(interestRate) || interestRate < 0)) {
    return NextResponse.json(
      { error: "Interest rate must be a positive number." },
      { status: 400 }
    );
  }

  if (termMonths !== null && (Number.isNaN(termMonths) || termMonths <= 0)) {
    return NextResponse.json(
      { error: "Loan term must be a positive number of months." },
      { status: 400 }
    );
  }

  if (priority !== null && (Number.isNaN(priority) || priority <= 0)) {
    return NextResponse.json(
      { error: "Priority must be a positive number." },
      { status: 400 }
    );
  }

  if (accountId) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json({ error: "Invalid account selection." }, { status: 400 });
    }
    const balance = Math.abs(
      account.currentBalance ?? account.availableBalance ?? 0
    );
    if (balance <= 0) {
      return NextResponse.json(
        { error: "Selected account has no balance to track." },
        { status: 400 }
      );
    }
    target = balance;
  }

  if (Number.isNaN(target) || target <= 0) {
    return NextResponse.json({ error: "Invalid goal details." }, { status: 400 });
  }

  if (!Object.values(GoalType).includes(type as GoalType)) {
    return NextResponse.json({ error: "Invalid goal type." }, { status: 400 });
  }

  if (!Object.values(GoalCadence).includes(cadence as GoalCadence)) {
    return NextResponse.json({ error: "Invalid goal cadence." }, { status: 400 });
  }

  if (!["ACTIVE", "COMPLETED"].includes(status)) {
    return NextResponse.json({ error: "Invalid goal status." }, { status: 400 });
  }

  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      accountId: accountId,
      name,
      type: type as GoalType,
      cadence: cadence as GoalCadence,
      target,
      current: 0,
      category,
      startDate,
      endDate,
      minPayment: minPayment,
      interestRate: interestRate,
      termMonths: termMonths,
      priority: priority,
      status: status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  return NextResponse.json({ goal });
}

export async function DELETE(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.reset === true) {
    const result = await prisma.goal.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true, deleted: result.count });
  }

  const goalId = String(body?.goalId ?? "").trim();
  if (!goalId) {
    return NextResponse.json({ error: "Missing goal id." }, { status: 400 });
  }

  const result = await prisma.goal.deleteMany({
    where: { id: goalId, userId: user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const goalId = String(body?.goalId ?? "").trim();
  if (!goalId) {
    return NextResponse.json({ error: "Missing goal id." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Invalid goal name." }, { status: 400 });
    }
    updates.name = name;
  }
  if (body?.target !== undefined) {
    const target = Number(body.target);
    if (Number.isNaN(target) || target <= 0) {
      return NextResponse.json({ error: "Invalid target amount." }, { status: 400 });
    }
    updates.target = target;
  }
  if (body?.minPayment !== undefined) {
    const minPayment = body.minPayment === null ? null : Number(body.minPayment);
    if (minPayment !== null && (Number.isNaN(minPayment) || minPayment < 0)) {
      return NextResponse.json(
        { error: "Minimum payment must be a positive number." },
        { status: 400 }
      );
    }
    updates.minPayment = minPayment;
  }
  if (body?.interestRate !== undefined) {
    const interestRate =
      body.interestRate === null ? null : Number(body.interestRate);
    if (interestRate !== null && (Number.isNaN(interestRate) || interestRate < 0)) {
      return NextResponse.json(
        { error: "Interest rate must be a positive number." },
        { status: 400 }
      );
    }
    updates.interestRate = interestRate;
  }
  if (body?.termMonths !== undefined) {
    const termMonths = body.termMonths === null ? null : Number(body.termMonths);
    if (termMonths !== null && (Number.isNaN(termMonths) || termMonths <= 0)) {
      return NextResponse.json(
        { error: "Loan term must be a positive number of months." },
        { status: 400 }
      );
    }
    updates.termMonths = termMonths;
  }
  if (body?.endDate !== undefined) {
    if (body.endDate === null || body.endDate === "") {
      updates.endDate = null;
    } else {
      const parsed = new Date(body.endDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid end date." }, { status: 400 });
      }
      updates.endDate = parsed;
    }
  }

  if (body?.status) {
    const status = String(body.status);
    if (!["ACTIVE", "COMPLETED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = status;
    updates.completedAt = status === "COMPLETED" ? new Date() : null;
  }

  const updated = await prisma.goal.updateMany({
    where: { id: goalId, userId: user.id },
    data: updates,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
