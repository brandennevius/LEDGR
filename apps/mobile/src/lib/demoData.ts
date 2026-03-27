type DemoAccount = {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  mask?: string;
  institutionName?: string;
  balance: number;
};

type DemoCategory = {
  name: string;
  essential: boolean;
  budget: number;
  color: string;
  group: string;
};

type DemoGoal = {
  id: string;
  name: string;
  type: 'SAVINGS' | 'SPEND_LIMIT' | 'INCOME_TARGET' | 'DEBT' | 'BUFFER_DAYS';
  cadence: 'MONTHLY';
  target: number;
  current: number;
  category?: string | null;
  accountId?: string | null;
  minPayment?: number | null;
  interestRate?: number | null;
  termMonths?: number | null;
  status: 'ACTIVE' | 'COMPLETED';
  startDate?: string | null;
  endDate?: string | null;
};

type DemoTransaction = {
  id: string;
  accountId: string;
  name: string;
  merchantName?: string;
  amount: number;
  category?: string | null;
  transactionType: 'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR';
  date: string;
  needsReview?: boolean;
  splits?: Array<{ id: string; category: string; amount: number; note?: string | null }>;
};

type DemoOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

type DemoChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const today = '2026-03-15T12:00:00.000Z';

const baseAccounts: DemoAccount[] = [
  {
    id: 'demo-checking',
    name: 'Harbor Checking',
    type: 'depository',
    subtype: 'checking',
    mask: '2841',
    institutionName: 'Bank of America',
    balance: 4821.43,
  },
  {
    id: 'demo-savings',
    name: 'Rainy Day Savings',
    type: 'depository',
    subtype: 'savings',
    mask: '9801',
    institutionName: 'Ally',
    balance: 12350.22,
  },
  {
    id: 'demo-card',
    name: 'Meridian Travel Card',
    type: 'credit',
    subtype: 'credit card',
    mask: '6427',
    institutionName: 'Chase',
    balance: -1488.23,
  },
  {
    id: 'demo-loan',
    name: 'Northstar Auto Loan',
    type: 'loan',
    subtype: 'auto',
    mask: '1170',
    institutionName: 'Capital One',
    balance: -11840.55,
  },
];

const demoConnectionByAccountId: Record<string, string> = {
  'demo-checking': 'demo-item-bofa',
  'demo-savings': 'demo-item-ally',
  'demo-card': 'demo-item-chase',
  'demo-loan': 'demo-item-cap1',
};

const baseCategories: DemoCategory[] = [
  { name: 'Housing', essential: true, budget: 1800, color: '#38bdf8', group: 'Essentials' },
  { name: 'Groceries', essential: true, budget: 650, color: '#22c55e', group: 'Essentials' },
  { name: 'Transport', essential: true, budget: 260, color: '#f59e0b', group: 'Essentials' },
  { name: 'Utilities', essential: true, budget: 220, color: '#14b8a6', group: 'Essentials' },
  { name: 'Dining', essential: false, budget: 340, color: '#f97316', group: 'Lifestyle' },
  { name: 'Subscriptions', essential: false, budget: 140, color: '#a78bfa', group: 'Lifestyle' },
  { name: 'Shopping', essential: false, budget: 450, color: '#f43f5e', group: 'Lifestyle' },
  { name: 'Travel', essential: false, budget: 300, color: '#06b6d4', group: 'Lifestyle' },
  { name: 'Entertainment', essential: false, budget: 180, color: '#facc15', group: 'Lifestyle' },
];

const baseTransactions: DemoTransaction[] = [
  {
    id: 'demo-tx-01',
    accountId: 'demo-checking',
    name: 'SOLSTICE PAYROLL',
    merchantName: 'Solstice Payroll',
    amount: -3250,
    category: 'Income',
    transactionType: 'INCOME',
    date: '2026-03-01T14:00:00.000Z',
  },
  {
    id: 'demo-tx-02',
    accountId: 'demo-checking',
    name: 'AURORA APARTMENTS',
    merchantName: 'Aurora Apartments',
    amount: 1725,
    category: 'Housing',
    transactionType: 'REGULAR',
    date: '2026-03-02T15:00:00.000Z',
  },
  {
    id: 'demo-tx-03',
    accountId: 'demo-checking',
    name: 'GREENFIELD MARKET',
    merchantName: 'Greenfield Market',
    amount: 132.48,
    category: 'Groceries',
    transactionType: 'REGULAR',
    date: '2026-03-03T18:00:00.000Z',
  },
  {
    id: 'demo-tx-04',
    accountId: 'demo-checking',
    name: 'NOVA SUSHI',
    merchantName: 'Nova Sushi',
    amount: 48.22,
    category: 'Dining',
    transactionType: 'REGULAR',
    date: '2026-03-03T23:00:00.000Z',
  },
  {
    id: 'demo-tx-05',
    accountId: 'demo-checking',
    name: 'CLOUDPLAY',
    merchantName: 'CloudPlay',
    amount: 16.99,
    category: 'Subscriptions',
    transactionType: 'REGULAR',
    date: '2026-03-04T12:00:00.000Z',
  },
  {
    id: 'demo-tx-06',
    accountId: 'demo-checking',
    name: 'CITY POWER',
    merchantName: 'City Power',
    amount: 108.37,
    category: 'Utilities',
    transactionType: 'REGULAR',
    date: '2026-03-05T15:00:00.000Z',
  },
  {
    id: 'demo-tx-07',
    accountId: 'demo-checking',
    name: 'TRANSFER TO ALLY',
    merchantName: 'Transfer to Ally',
    amount: 500,
    category: null,
    transactionType: 'INTERNAL_TRANSFER',
    date: '2026-03-06T14:00:00.000Z',
  },
  {
    id: 'demo-tx-08',
    accountId: 'demo-savings',
    name: 'TRANSFER FROM BOFA',
    merchantName: 'Transfer from BOFA',
    amount: -500,
    category: null,
    transactionType: 'INTERNAL_TRANSFER',
    date: '2026-03-06T14:00:00.000Z',
  },
  {
    id: 'demo-tx-09',
    accountId: 'demo-checking',
    name: 'METRO TRANSIT',
    merchantName: 'Metro Transit',
    amount: 22,
    category: 'Transport',
    transactionType: 'REGULAR',
    date: '2026-03-07T13:00:00.000Z',
  },
  {
    id: 'demo-tx-10',
    accountId: 'demo-card',
    name: 'STUDIO FURNITURE',
    merchantName: 'Studio Furniture',
    amount: 189.5,
    category: 'Shopping',
    transactionType: 'REGULAR',
    date: '2026-03-08T19:00:00.000Z',
    needsReview: true,
  },
  {
    id: 'demo-tx-11',
    accountId: 'demo-card',
    name: 'PACIFIC AIR',
    merchantName: 'Pacific Air',
    amount: 248.7,
    category: 'Travel',
    transactionType: 'REGULAR',
    date: '2026-03-09T18:00:00.000Z',
  },
  {
    id: 'demo-tx-12',
    accountId: 'demo-checking',
    name: 'SOLSTICE PAYROLL',
    merchantName: 'Solstice Payroll',
    amount: -3250,
    category: 'Income',
    transactionType: 'INCOME',
    date: '2026-03-15T14:00:00.000Z',
  },
  {
    id: 'demo-tx-13',
    accountId: 'demo-checking',
    name: 'GREENFIELD MARKET',
    merchantName: 'Greenfield Market',
    amount: 98.41,
    category: 'Groceries',
    transactionType: 'REGULAR',
    date: '2026-03-15T19:00:00.000Z',
  },
  {
    id: 'demo-tx-14',
    accountId: 'demo-checking',
    name: 'NOVA SUSHI',
    merchantName: 'Nova Sushi',
    amount: 56.14,
    category: 'Dining',
    transactionType: 'REGULAR',
    date: '2026-03-16T23:00:00.000Z',
  },
  {
    id: 'demo-tx-15',
    accountId: 'demo-card',
    name: 'LUMEN CINEMA',
    merchantName: 'Lumen Cinema',
    amount: 34,
    category: 'Entertainment',
    transactionType: 'REGULAR',
    date: '2026-03-17T22:00:00.000Z',
  },
  {
    id: 'demo-tx-16',
    accountId: 'demo-checking',
    name: 'JET WASH',
    merchantName: 'Jet Wash',
    amount: 19,
    category: 'Transport',
    transactionType: 'REGULAR',
    date: '2026-03-18T13:00:00.000Z',
  },
  {
    id: 'demo-tx-17',
    accountId: 'demo-checking',
    name: 'CITY POWER',
    merchantName: 'City Power',
    amount: 112.08,
    category: 'Utilities',
    transactionType: 'REGULAR',
    date: '2026-03-19T15:00:00.000Z',
  },
  {
    id: 'demo-tx-18',
    accountId: 'demo-checking',
    name: 'MERIDIAN CARD PAYMENT',
    merchantName: 'Meridian Card Payment',
    amount: 300,
    category: null,
    transactionType: 'INTERNAL_TRANSFER',
    date: '2026-03-20T15:00:00.000Z',
  },
  {
    id: 'demo-tx-19',
    accountId: 'demo-card',
    name: 'MERIDIAN CARD PAYMENT',
    merchantName: 'Meridian Card Payment',
    amount: -300,
    category: null,
    transactionType: 'INTERNAL_TRANSFER',
    date: '2026-03-20T15:00:00.000Z',
  },
  {
    id: 'demo-tx-20',
    accountId: 'demo-checking',
    name: 'WARDROBE COLLECTIVE',
    merchantName: 'Wardrobe Collective',
    amount: 142.27,
    category: 'Shopping',
    transactionType: 'REGULAR',
    date: '2026-03-22T18:00:00.000Z',
  },
  {
    id: 'demo-tx-21',
    accountId: 'demo-checking',
    name: 'COASTAL REFUND',
    merchantName: 'Coastal Refund',
    amount: -64.4,
    category: 'Travel',
    transactionType: 'REGULAR',
    date: '2026-03-23T14:00:00.000Z',
  },
  {
    id: 'demo-tx-22',
    accountId: 'demo-card',
    name: 'MOTION STUDIO',
    merchantName: 'Motion Studio',
    amount: 86.75,
    category: 'Shopping',
    transactionType: 'REGULAR',
    date: '2026-03-24T16:00:00.000Z',
    needsReview: true,
  },
  {
    id: 'demo-tx-23',
    accountId: 'demo-checking',
    name: 'AURORA APARTMENTS',
    merchantName: 'Aurora Apartments',
    amount: 1725,
    category: 'Housing',
    transactionType: 'REGULAR',
    date: '2026-02-02T15:00:00.000Z',
  },
  {
    id: 'demo-tx-24',
    accountId: 'demo-checking',
    name: 'SOLSTICE PAYROLL',
    merchantName: 'Solstice Payroll',
    amount: -3180,
    category: 'Income',
    transactionType: 'INCOME',
    date: '2026-02-01T14:00:00.000Z',
  },
  {
    id: 'demo-tx-25',
    accountId: 'demo-card',
    name: 'PACIFIC AIR',
    merchantName: 'Pacific Air',
    amount: 318.22,
    category: 'Travel',
    transactionType: 'REGULAR',
    date: '2026-02-11T19:00:00.000Z',
  },
  {
    id: 'demo-tx-26',
    accountId: 'demo-checking',
    name: 'GREENFIELD MARKET',
    merchantName: 'Greenfield Market',
    amount: 116.18,
    category: 'Groceries',
    transactionType: 'REGULAR',
    date: '2026-02-17T18:00:00.000Z',
  },
];

const baseGoals: DemoGoal[] = [
  {
    id: 'demo-goal-emergency',
    name: 'Emergency fund',
    type: 'SAVINGS',
    cadence: 'MONTHLY',
    target: 20000,
    current: 17171.65,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2026-08-31',
  },
  {
    id: 'demo-goal-card',
    name: 'Travel card payoff',
    type: 'DEBT',
    cadence: 'MONTHLY',
    target: 2500,
    current: 1011.77,
    accountId: 'demo-card',
    minPayment: 120,
    interestRate: 22.9,
    termMonths: 24,
    status: 'ACTIVE',
    startDate: '2026-02-01',
    endDate: '2026-09-30',
  },
  {
    id: 'demo-goal-buffer',
    name: '30-day cash buffer',
    type: 'BUFFER_DAYS',
    cadence: 'MONTHLY',
    target: 30,
    current: 23.4,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  },
];

let demoAccountsState = baseAccounts.map((account) => ({ ...account }));
let demoCategoriesState = baseCategories.map((category) => ({ ...category }));
let demoTransactionsState = baseTransactions.map((tx) => ({
  ...tx,
  splits: tx.splits?.map((split) => ({ ...split })),
}));
let demoGoalsState = baseGoals.map((goal) => ({ ...goal }));
let demoMonthlyIncomeOverride: number | null = null;

const formatMonthDay = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });

const getAccountById = (accountId: string) =>
  demoAccountsState.find((account) => account.id === accountId) ?? null;

const getDemoCashOnHand = () =>
  demoAccountsState
    .filter((account) => account.type === 'depository')
    .reduce((sum, account) => sum + Math.max(account.balance, 0), 0);

const buildMonthSeries = () => {
  const currentMonth = '2026-03';
  const spendByDay = new Map<number, number>();
  const incomeByDay = new Map<number, number>();

  demoTransactionsState.forEach((tx) => {
    if (!tx.date.startsWith(currentMonth)) return;
    const day = Number(tx.date.slice(8, 10));
    if (tx.transactionType === 'INTERNAL_TRANSFER') return;
    if (tx.amount < 0) {
      incomeByDay.set(day, (incomeByDay.get(day) ?? 0) + Math.abs(tx.amount));
      return;
    }
    spendByDay.set(day, (spendByDay.get(day) ?? 0) + tx.amount);
  });

  const spend: number[] = [];
  const income: number[] = [];
  let spendRunning = 0;
  let incomeRunning = 0;
  for (let day = 1; day <= 31; day += 1) {
    spendRunning += spendByDay.get(day) ?? 0;
    incomeRunning += incomeByDay.get(day) ?? 0;
    spend.push(Number(spendRunning.toFixed(2)));
    income.push(Number(incomeRunning.toFixed(2)));
  }
  return { spend, income };
};

const isCurrentMonthRegularSpend = (tx: DemoTransaction) =>
  tx.date.startsWith('2026-03') &&
  tx.transactionType === 'REGULAR' &&
  tx.amount > 0;

const isPreviousMonthRegularSpend = (tx: DemoTransaction) =>
  tx.date.startsWith('2026-02') &&
  tx.transactionType === 'REGULAR' &&
  tx.amount > 0;

const buildCategoryOverview = () => {
  const spendByCategory = new Map<string, number>();
  const prevSpendByCategory = new Map<string, number>();
  const recentTransactions: Array<{
    id: string;
    name: string;
    amount: number;
    category: string;
    date: string;
  }> = [];

  demoTransactionsState.forEach((tx) => {
    if (isCurrentMonthRegularSpend(tx)) {
      const key = tx.category ?? 'Uncategorized';
      spendByCategory.set(key, (spendByCategory.get(key) ?? 0) + tx.amount);
      recentTransactions.push({
        id: tx.id,
        name: tx.merchantName ?? tx.name,
        amount: tx.amount,
        category: key,
        date: tx.date,
      });
    }
    if (isPreviousMonthRegularSpend(tx)) {
      const key = tx.category ?? 'Uncategorized';
      prevSpendByCategory.set(key, (prevSpendByCategory.get(key) ?? 0) + tx.amount);
    }
  });

  const categories = demoCategoriesState.map((category) => {
    const spend = Number((spendByCategory.get(category.name) ?? 0).toFixed(2));
    const prevSpend = Number((prevSpendByCategory.get(category.name) ?? 0).toFixed(2));
    const projected = Number((spend * (31 / 15)).toFixed(2));
    const remaining = Number((category.budget - spend).toFixed(2));
    const status =
      projected > category.budget
        ? projected > category.budget * 1.08
          ? 'over'
          : 'risk'
        : 'ok';
    return {
      name: category.name,
      spend,
      prevSpend,
      budget: category.budget,
      color: category.color,
      essential: category.essential,
      projected,
      remaining,
      status,
    };
  });

  const groups = Array.from(
    demoCategoriesState.reduce((map, category) => {
      const list = map.get(category.group) ?? [];
      list.push(category.name);
      map.set(category.group, list);
      return map;
    }, new Map<string, string[]>())
  ).map(([name, categoryNames], index) => {
    const groupCategories = categories.filter((row) => categoryNames.includes(row.name));
    const spend = groupCategories.reduce((sum, row) => sum + row.spend, 0);
    const budget = groupCategories.reduce((sum, row) => sum + (row.budget ?? 0), 0);
    return {
      id: `demo-group-${index}`,
      name,
      spend,
      budget,
      unassignedBudget: null,
      status: spend > budget ? 'over' : spend > budget * 0.9 ? 'risk' : 'ok',
      categories: groupCategories,
    };
  });

  const spendTotal = categories.reduce((sum, row) => sum + row.spend, 0);
  const budgetTotal = categories.reduce((sum, row) => sum + (row.budget ?? 0), 0);

  return {
    summary: {
      mode: 'budget',
      spend: Number(spendTotal.toFixed(2)),
      budget: Number(budgetTotal.toFixed(2)),
      projected: Number((spendTotal * (31 / 15)).toFixed(2)),
      prevSpend: Number(
        categories.reduce((sum, row) => sum + row.prevSpend, 0).toFixed(2)
      ),
      changePct: 8.4,
    },
    categories,
    groups,
    transactions: recentTransactions
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((tx) => ({ ...tx, date: tx.date.slice(0, 10) })),
  };
};

const buildClientOverview = () => {
  const monthSeries = buildMonthSeries();
  const categoryOverview = buildCategoryOverview();
  const totalIncome = monthSeries.income[monthSeries.income.length - 1] ?? 0;
  const totalSpend = monthSeries.spend[monthSeries.spend.length - 1] ?? 0;
  const expectedIncome = 6500;
  return {
    clientName: 'Alex Rivera',
    accounts: demoAccountsState.map((account) => ({
      id: account.id,
      plaidItemId: demoConnectionByAccountId[account.id],
      name: account.name,
      type: account.type,
      mask: account.mask,
      institutionName: account.institutionName,
      balance: account.balance,
    })),
    plaidItems: [
      {
        id: 'demo-item-bofa',
        itemId: 'demo-item-bofa',
        institutionName: 'Bank of America',
        status: 'active',
        updatedAt: today,
      },
      {
        id: 'demo-item-ally',
        itemId: 'demo-item-ally',
        institutionName: 'Ally',
        status: 'active',
        updatedAt: today,
      },
      {
        id: 'demo-item-chase',
        itemId: 'demo-item-chase',
        institutionName: 'Chase',
        status: 'active',
        updatedAt: today,
      },
      {
        id: 'demo-item-cap1',
        itemId: 'demo-item-cap1',
        institutionName: 'Capital One',
        status: 'active',
        updatedAt: today,
      },
    ],
    monthDailySpend: monthSeries.spend,
    monthDailyIncome: monthSeries.income,
    monthSpendTotal: totalSpend,
    monthBudgetTotal: categoryOverview.summary.budget,
    monthDaysElapsed: 15,
    incomeSummary: {
      actual: totalIncome,
      expected: expectedIncome,
      remaining: Math.max(expectedIncome - totalIncome, 0),
      variance: totalIncome - expectedIncome,
      progress: Number((totalIncome / expectedIncome).toFixed(2)),
    },
    connectionStatus: {
      state: 'connected',
      title: '',
      description: '',
    },
    syncSummary: {
      totalConnections: 4,
      activeConnections: 4,
      staleConnections: 0,
      attentionConnections: 0,
      lastSuccessfulSyncAt: today,
    },
    categoryBudgets: categoryOverview.categories.map((row) => ({
      name: row.name,
      essential: row.essential,
      budget: row.budget ?? 0,
      spend: row.spend,
      projected: row.projected,
      remaining: row.remaining ?? 0,
      status: row.status === 'neutral' ? 'ok' : row.status,
    })),
  };
};

const buildTransactionsResponse = (path: URL) => {
  let transactions = [...demoTransactionsState];
  const accountId = path.searchParams.get('accountId');
  const category = path.searchParams.get('category');
  const days = Number(path.searchParams.get('days') ?? '30');
  const month = path.searchParams.get('month');
  const year = path.searchParams.get('year');
  const needsReview = path.searchParams.get('needsReview') === 'true';

  if (accountId) {
    transactions = transactions.filter((tx) => tx.accountId === accountId);
  }
  if (category && category !== 'All') {
    transactions = transactions.filter((tx) => (tx.category ?? 'Uncategorized') === category);
  }
  if (month) {
    transactions = transactions.filter((tx) => tx.date.startsWith(month));
  } else if (year) {
    transactions = transactions.filter((tx) => tx.date.startsWith(year));
  } else if (Number.isFinite(days)) {
    const end = new Date(today);
    const start = new Date(end);
    start.setDate(end.getDate() - Math.max(days, 1));
    transactions = transactions.filter((tx) => {
      const date = new Date(tx.date);
      return date >= start && date <= end;
    });
  }
  if (needsReview) {
    transactions = transactions.filter((tx) => tx.needsReview);
  }

  return {
    transactions: transactions
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((tx) => ({
        id: tx.id,
        baseId: tx.id,
        accountId: tx.accountId,
        name: tx.merchantName ?? tx.name,
        category:
          tx.transactionType === 'INTERNAL_TRANSFER'
            ? 'Internal transfer'
            : tx.transactionType === 'INCOME'
            ? 'Income'
            : tx.category ?? 'Uncategorized',
        amount: Math.abs(tx.amount),
        isInflow: tx.amount < 0,
        isIncome: tx.transactionType === 'INCOME',
        transactionType: tx.transactionType,
        needsReview: Boolean(tx.needsReview),
        hasSplits: Boolean(tx.splits?.length),
        date: formatMonthDay(tx.date),
        dateIso: tx.date,
      })),
    accounts: demoAccountsState.map((account) => ({
      id: account.id,
      name: account.name,
      institutionName: account.institutionName,
      mask: account.mask,
    })),
  };
};

const buildTransactionDetail = (id: string) => {
  const tx = demoTransactionsState.find((item) => item.id === id);
  if (!tx) {
    throw { error: 'Not found', status: 404 };
  }
  const account = getAccountById(tx.accountId);
  return {
    id: tx.id,
    name: tx.merchantName ?? tx.name,
    amount: tx.amount,
    isInflow: tx.amount < 0,
    isIncome: tx.transactionType === 'INCOME',
    category:
      tx.transactionType === 'INTERNAL_TRANSFER'
        ? 'Internal transfer'
        : tx.transactionType === 'INCOME'
        ? 'Income'
        : tx.category ?? 'Uncategorized',
    transactionType: tx.transactionType,
    date: tx.date,
    needsReview: Boolean(tx.needsReview),
    hasSplits: Boolean(tx.splits?.length),
    splits:
      tx.splits?.map((split) => ({
        id: split.id,
        category: split.category,
        amount: Math.abs(split.amount),
        note: split.note ?? null,
      })) ?? [],
    account: account
      ? {
          name: account.name,
          institutionName: account.institutionName,
          mask: account.mask,
          type: account.type,
        }
      : undefined,
  };
};

const buildDistributionResponse = () => ({
  cashFlowTransactions: demoTransactionsState.map((tx) => ({
    id: tx.id,
    date: tx.date,
    name: tx.merchantName ?? tx.name,
    category:
      tx.transactionType === 'INTERNAL_TRANSFER'
        ? 'Internal transfer'
        : tx.transactionType === 'INCOME'
        ? 'Income'
        : tx.category ?? 'Uncategorized',
    amount: Math.abs(tx.amount),
    type:
      tx.transactionType === 'INCOME'
        ? 'income'
        : tx.transactionType === 'INTERNAL_TRANSFER'
        ? 'internal_transfer'
        : 'spend',
    excluded: tx.transactionType === 'INTERNAL_TRANSFER',
  })),
});

const buildGoalsSetupData = () => ({
  debtAccounts: demoAccountsState
    .filter((account) => account.type === 'credit' || account.type === 'loan')
    .map((account) => ({
      id: account.id,
      name: account.name,
      institutionName: account.institutionName,
      mask: account.mask,
      balance: Math.abs(account.balance),
      estimatedPayment: account.id === 'demo-card' ? 120 : 340,
    })),
  hasExistingGoals: demoGoalsState.length > 0,
  liquidCash: getDemoCashOnHand(),
});

const buildGoalsSummary = () => ({
  status: 'on_track',
  summary:
    'You are ahead on savings contributions and keeping debt payoff moving. Biggest risk this month is shopping drift, not income.',
});

const getGoalCurrent = (goal: DemoGoal) => {
  if (goal.type === 'SAVINGS') return getDemoCashOnHand();
  if (goal.type === 'BUFFER_DAYS') return 23.4;
  if (goal.type === 'DEBT' && goal.accountId) {
    const account = getAccountById(goal.accountId);
    if (account) {
      return Number(Math.max(0, goal.target - Math.abs(account.balance)).toFixed(2));
    }
  }
  return goal.current;
};

const buildGoalsResponse = () => ({
  goals: demoGoalsState.map((goal) => ({
    ...goal,
    current: getGoalCurrent(goal),
  })),
});

const buildGoalInsight = (goalId: string) => {
  const goal = demoGoalsState.find((item) => item.id === goalId);
  if (!goal) {
    throw { error: 'Goal not found.', status: 404 };
  }
  if (goal.type !== 'DEBT') {
    return { insight: 'Keep contributions steady and protect your monthly surplus to stay on pace.' };
  }
  return {
    insight:
      'You are on pace, but this payoff gets faster if you redirect shopping overflow and one extra $150 payment after each paycheck. Keep the minimum covered first, then sweep surplus to the card.',
  };
};

function createGoal(body: Record<string, unknown>) {
  const nextId = `demo-goal-${Date.now()}`;
  const target = Number(body.target ?? 0);
  const goal: DemoGoal = {
    id: nextId,
    name: String(body.name ?? 'Goal'),
    type: String(body.type ?? 'SAVINGS') as DemoGoal['type'],
    cadence: 'MONTHLY',
    target,
    current: 0,
    category: typeof body.category === 'string' ? body.category : null,
    accountId: typeof body.accountId === 'string' ? body.accountId : null,
    minPayment: typeof body.minPayment === 'number' ? body.minPayment : null,
    interestRate: typeof body.interestRate === 'number' ? body.interestRate : null,
    termMonths: typeof body.termMonths === 'number' ? body.termMonths : null,
    status: 'ACTIVE',
    startDate: typeof body.startDate === 'string' ? body.startDate : null,
    endDate: typeof body.endDate === 'string' ? body.endDate : null,
  };
  goal.current = getGoalCurrent(goal);
  demoGoalsState = [goal, ...demoGoalsState];
  return { goal };
}

function deleteGoal(body: Record<string, unknown>) {
  if (body.reset === true) {
    const deleted = demoGoalsState.length;
    demoGoalsState = [];
    return { ok: true, deleted };
  }
  const goalId = String(body.goalId ?? '');
  demoGoalsState = demoGoalsState.filter((goal) => goal.id !== goalId);
  return { ok: true };
}

function updateTransaction(id: string, body: Record<string, unknown>) {
  demoTransactionsState = demoTransactionsState.map((tx) => {
    if (tx.id !== id) return tx;
    const nextType =
      body.transactionType === 'INCOME' ||
      body.transactionType === 'INTERNAL_TRANSFER' ||
      body.transactionType === 'REGULAR'
        ? body.transactionType
        : tx.transactionType;
    const nextAmount =
      typeof body.amount === 'number'
        ? body.amount
        : tx.amount;
    return {
      ...tx,
      amount: nextAmount,
      transactionType: nextType,
      category:
        nextType !== 'REGULAR'
          ? null
          : typeof body.category === 'string'
          ? body.category
          : tx.category,
      needsReview: false,
    };
  });
  return { ok: true };
}

function markReviewed(body: Record<string, unknown>) {
  const id = String(body.id ?? '');
  demoTransactionsState = demoTransactionsState.map((tx) =>
    tx.id === id ? { ...tx, needsReview: false } : tx
  );
  return { ok: true };
}

function createCategory(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  if (!name) return { ok: true };
  if (!demoCategoriesState.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    demoCategoriesState = [
      ...demoCategoriesState,
      {
        name,
        essential: Boolean(body.essential),
        budget: typeof body.monthlyBudget === 'number' ? body.monthlyBudget : 0,
        color: typeof body.color === 'string' && body.color ? body.color : '#38bdf8',
        group: 'Lifestyle',
      },
    ];
  }
  return { ok: true };
}

function updateCategory(body: Record<string, unknown>) {
  const currentName = String(body.currentName ?? '').trim();
  const nextName = String(body.name ?? currentName).trim();
  if (!currentName || !nextName) return { ok: true };

  demoCategoriesState = demoCategoriesState.map((category) => {
    if (category.name !== currentName) return category;
    return {
      ...category,
      name: nextName,
      budget: typeof body.monthlyBudget === 'number' ? body.monthlyBudget : category.budget,
      essential:
        typeof body.essential === 'boolean' ? body.essential : category.essential,
      color:
        typeof body.color === 'string' && body.color ? body.color : category.color,
    };
  });

  demoTransactionsState = demoTransactionsState.map((tx) =>
    tx.category === currentName ? { ...tx, category: nextName } : tx
  );
  demoGoalsState = demoGoalsState.map((goal) =>
    goal.category === currentName ? { ...goal, category: nextName } : goal
  );

  return { ok: true };
}

function deleteCategory(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  if (!name) return { ok: true };
  demoCategoriesState = demoCategoriesState.filter((category) => category.name !== name);
  demoTransactionsState = demoTransactionsState.map((tx) =>
    tx.category === name ? { ...tx, category: 'Uncategorized' } : tx
  );
  demoGoalsState = demoGoalsState.map((goal) =>
    goal.category === name ? { ...goal, category: null } : goal
  );
  return { ok: true };
}

function updateCategoryGroup(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  const categories = Array.isArray(body.categories)
    ? body.categories
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    : [];
  if (!name || categories.length === 0) return { ok: true };

  demoCategoriesState = demoCategoriesState.map((category) =>
    categories.includes(category.name) ? { ...category, group: name } : category
  );
  return { ok: true };
}

function updateTransactionSplits(id: string, body: Record<string, unknown>) {
  const nextSplits = Array.isArray(body.splits)
    ? body.splits
        .map((split, index) => {
          if (!split || typeof split !== 'object') return null;
          const item = split as Record<string, unknown>;
          const category = String(item.category ?? '').trim();
          const amount = Number(item.amount ?? 0);
          if (!category || !Number.isFinite(amount) || amount <= 0) return null;
          return {
            id: `demo-split-${id}-${index}`,
            category,
            amount,
            note: typeof item.note === 'string' ? item.note : null,
          };
        })
        .filter(Boolean)
    : [];

  demoTransactionsState = demoTransactionsState.map((tx) =>
    tx.id === id
      ? {
          ...tx,
          splits: nextSplits as NonNullable<DemoTransaction['splits']>,
          needsReview: false,
        }
      : tx
  );
  return { ok: true };
}

function getSettings() {
  return {
    monthlyIncomeOverride: demoMonthlyIncomeOverride,
  };
}

function updateSettings(body: Record<string, unknown>) {
  const nextValue = body.monthlyIncomeOverride;
  demoMonthlyIncomeOverride =
    typeof nextValue === 'number' && Number.isFinite(nextValue) ? nextValue : null;
  return getSettings();
}

function buildDemoChatAnswer(messages: DemoChatMessage[]) {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')
    ?.content.toLowerCase();

  if (latestUserMessage?.includes('goal')) {
    return `You are carrying strong monthly income and healthy cash reserves in this demo profile. The cleanest next goal is to finish the travel card payoff, then sweep that payment into the emergency fund.`;
  }

  if (latestUserMessage?.includes('spend') || latestUserMessage?.includes('budget')) {
    return `March spend is concentrated in housing, shopping, and travel. The fastest coaching move is to tighten shopping and dining, because those are the categories with the most discretionary room.`;
  }

  if (latestUserMessage?.includes('income') || latestUserMessage?.includes('cash flow')) {
    return `Demo cash flow is positive this month. Income is arriving on schedule, spend is under the total budget, and internal transfers are excluded from coaching totals.`;
  }

  return `This demo profile shows linked banking, credit, and loan accounts with realistic cash flow, budgets, and goals. Ask about spending, savings targets, debt payoff, or what changed this month.`;
}

export function buildDemoChatResponse(body: unknown) {
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const messages = Array.isArray(payload.messages)
    ? payload.messages
        .map((message) => {
          if (!message || typeof message !== 'object') return null;
          const item = message as Record<string, unknown>;
          if (
            (item.role !== 'user' && item.role !== 'assistant') ||
            typeof item.content !== 'string'
          ) {
            return null;
          }
          return {
            role: item.role,
            content: item.content,
          } as DemoChatMessage;
        })
        .filter(Boolean) as DemoChatMessage[]
    : [];

  return {
    answer: buildDemoChatAnswer(messages),
  };
}

function deleteAccount(body: Record<string, unknown>) {
  const accountId = String(body.accountId ?? '');
  demoAccountsState = demoAccountsState.filter((account) => account.id !== accountId);
  demoTransactionsState = demoTransactionsState.filter((tx) => tx.accountId !== accountId);
  demoGoalsState = demoGoalsState.filter((goal) => goal.accountId !== accountId);
  return { ok: true };
}

export function isDemoSupportedPath(path: string) {
  const methodless = path.split('?')[0];
  return (
    methodless === '/api/client/overview' ||
    methodless === '/api/settings' ||
    methodless === '/api/categories' ||
    methodless === '/api/categories/overview' ||
    methodless === '/api/category-groups' ||
    methodless === '/api/distribution' ||
    methodless === '/api/goals' ||
    methodless === '/api/goals/setup-data' ||
    methodless === '/api/goals/summary' ||
    methodless === '/api/goals/insights' ||
    methodless === '/api/insights/chat' ||
    methodless === '/api/accounts' ||
    methodless === '/api/transactions' ||
    methodless === '/api/transactions/review' ||
    methodless === '/api/plaid/accounts/sync' ||
    methodless === '/api/plaid/transactions/sync' ||
    methodless.startsWith('/api/transactions/')
  );
}

export async function handleDemoApiRequest<T>(path: string, options?: DemoOptions): Promise<T> {
  const method = options?.method ?? 'GET';
  const url = new URL(path, 'https://demo.ledgr.local');
  const body =
    options?.body && typeof options.body === 'object' ? (options.body as Record<string, unknown>) : {};

  if (method === 'GET' && url.pathname === '/api/client/overview') {
    return buildClientOverview() as T;
  }
  if (method === 'GET' && url.pathname === '/api/settings') {
    return getSettings() as T;
  }
  if (method === 'POST' && url.pathname === '/api/settings') {
    return updateSettings(body) as T;
  }
  if (method === 'GET' && url.pathname === '/api/categories') {
    return { categories: demoCategoriesState.map((item) => item.name) } as T;
  }
  if (method === 'POST' && url.pathname === '/api/categories') {
    return createCategory(body) as T;
  }
  if (method === 'PATCH' && url.pathname === '/api/categories') {
    return updateCategory(body) as T;
  }
  if (method === 'DELETE' && url.pathname === '/api/categories') {
    return deleteCategory(body) as T;
  }
  if (method === 'GET' && url.pathname === '/api/categories/overview') {
    return buildCategoryOverview() as T;
  }
  if (method === 'POST' && url.pathname === '/api/category-groups') {
    return updateCategoryGroup(body) as T;
  }
  if (method === 'GET' && url.pathname === '/api/distribution') {
    return buildDistributionResponse() as T;
  }
  if (method === 'GET' && url.pathname === '/api/goals') {
    return buildGoalsResponse() as T;
  }
  if (method === 'POST' && url.pathname === '/api/goals') {
    return createGoal(body) as T;
  }
  if (method === 'DELETE' && url.pathname === '/api/goals') {
    return deleteGoal(body) as T;
  }
  if (method === 'GET' && url.pathname === '/api/goals/setup-data') {
    return buildGoalsSetupData() as T;
  }
  if (method === 'POST' && url.pathname === '/api/goals/summary') {
    return buildGoalsSummary() as T;
  }
  if (method === 'POST' && url.pathname === '/api/goals/insights') {
    return buildGoalInsight(String(body.goalId ?? '')) as T;
  }
  if (method === 'POST' && url.pathname === '/api/insights/chat') {
    return buildDemoChatResponse(body) as T;
  }
  if (method === 'DELETE' && url.pathname === '/api/accounts') {
    return deleteAccount(body) as T;
  }
  if (method === 'POST' && url.pathname === '/api/transactions/review') {
    return markReviewed(body) as T;
  }
  if (method === 'GET' && url.pathname === '/api/transactions') {
    return buildTransactionsResponse(url) as T;
  }
  if (method === 'PATCH' && url.pathname.startsWith('/api/transactions/')) {
    return updateTransaction(url.pathname.split('/').pop() ?? '', body) as T;
  }
  if (method === 'PUT' && url.pathname.endsWith('/splits')) {
    const id = url.pathname.split('/')[3] ?? '';
    return updateTransactionSplits(id, body) as T;
  }
  if (method === 'GET' && url.pathname.startsWith('/api/transactions/')) {
    return buildTransactionDetail(url.pathname.split('/').pop() ?? '') as T;
  }
  if (
    method === 'POST' &&
    (url.pathname === '/api/plaid/accounts/sync' || url.pathname === '/api/plaid/transactions/sync')
  ) {
    return { ok: true } as T;
  }

  throw { error: 'Demo mode does not support this action yet.', status: 400 };
}
