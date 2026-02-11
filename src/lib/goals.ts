import type { Account, Goal } from "@prisma/client";

type GoalTransaction = {
  amount: number;
  date: Date;
  category?: string | null;
  name: string;
  merchantName?: string | null;
};

const debtPattern = /loan|debt|credit|card payment|payment|mortgage|student/i;

const getGoalWindow = (goal: Goal) => {
  const end = goal.endDate ? new Date(goal.endDate) : new Date();
  if (goal.startDate) {
    return { start: new Date(goal.startDate), end };
  }

  const start = new Date(end);
  const cadence = goal.cadence;
  if (cadence === "WEEKLY") {
    start.setDate(end.getDate() - 7);
  } else if (cadence === "BIWEEKLY") {
    start.setDate(end.getDate() - 14);
  } else if (cadence === "MONTHLY") {
    start.setDate(end.getDate() - 30);
  } else {
    start.setDate(end.getDate() - 30);
  }

  return { start, end };
};

const liquidAccountTypes = new Set(["depository", "cash"]);

export const computeCashOnHand = (accounts: Account[]) =>
  accounts.reduce((acc, account) => {
    const balance = account.currentBalance ?? account.availableBalance ?? 0;
    if (!liquidAccountTypes.has(account.type)) return acc;
    return acc + balance;
  }, 0);

export const computeGoalCurrent = ({
  goal,
  transactions,
  accounts,
  bufferDays,
  cashOnHand,
}: {
  goal: Goal;
  transactions: GoalTransaction[];
  accounts: Account[];
  bufferDays: number;
  cashOnHand: number;
}) => {
  if (goal.type === "SAVINGS") {
    return cashOnHand;
  }

  if (goal.type === "BUFFER_DAYS") {
    return bufferDays;
  }

  const { start, end } = getGoalWindow(goal);
  const scopedTransactions = transactions.filter(
    (tx) => tx.date >= start && tx.date <= end
  );

  if (goal.type === "INCOME_TARGET") {
    return scopedTransactions
      .filter((tx) => tx.amount < 0)
      .reduce((acc, tx) => acc + Math.abs(tx.amount), 0);
  }

  if (goal.type === "SPEND_LIMIT") {
    return scopedTransactions
      .filter((tx) => {
        if (tx.amount <= 0) return false;
        if (!goal.category) return true;
        return tx.category === goal.category;
      })
      .reduce((acc, tx) => acc + tx.amount, 0);
  }

  if (goal.type === "DEBT") {
    if (goal.accountId) {
      const account = accounts.find((item) => item.id === goal.accountId);
      if (account) {
        const balance = Math.abs(
          account.currentBalance ?? account.availableBalance ?? 0
        );
        return Math.max(0, goal.target - balance);
      }
    }
    return scopedTransactions
      .filter((tx) => {
        if (tx.amount <= 0) return false;
        const category = tx.category?.toLowerCase() ?? "";
        const name = (tx.merchantName ?? tx.name).toLowerCase();
        return debtPattern.test(category) || debtPattern.test(name);
      })
      .reduce((acc, tx) => acc + tx.amount, 0);
  }

  return goal.current;
};

export const hydrateGoals = ({
  goals,
  transactions,
  accounts,
  bufferDays,
}: {
  goals: Goal[];
  transactions: GoalTransaction[];
  accounts: Account[];
  bufferDays: number;
}) => {
  const cashOnHand = computeCashOnHand(accounts);
  return goals.map((goal) => ({
    ...goal,
    current: computeGoalCurrent({
      goal,
      transactions,
      accounts,
      bufferDays,
      cashOnHand,
    }),
  }));
};
