export const incomePattern =
  /income|payroll|salary|wages|benefit|deposit|refund/i;
export const transferPattern = /transfer|payment|p2p|venmo|cash app|zelle/i;
export const transferHintPattern =
  /transfer|payment|withdrawal|deposit|contribution|fund|move|cd|sweep/i;
export const investmentPattern =
  /invest|investment|brokerage|401k|403b|ira|roth|vanguard|fidelity|schwab|etrade|td ameritrade|betterment|wealthfront/i;

export const normalizeCategory = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

export const normalizeName = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

export const normalizeAccountType = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

export const isIncomeTransaction = (tx: {
  amount: number;
  category?: string | null;
  name?: string | null;
  merchantName?: string | null;
}) => {
  const category = normalizeCategory(tx.category);
  const name = (tx.merchantName ?? tx.name ?? "").toLowerCase();
  return (
    tx.amount < 0 || incomePattern.test(category) || incomePattern.test(name)
  );
};

export const isTransferTransaction = (tx: {
  category?: string | null;
  name?: string | null;
  merchantName?: string | null;
}) => {
  const category = normalizeCategory(tx.category);
  const name = normalizeName(tx.merchantName ?? tx.name ?? "");
  return transferPattern.test(category) || transferPattern.test(name);
};

export const classifyTransactionType = (tx: {
  amount: number;
  category?: string | null;
  name?: string | null;
  merchantName?: string | null;
  accountType?: string | null;
  accountSubtype?: string | null;
}) => {
  if (isIncomeTransaction(tx)) return "INCOME";
  if (isTransferTransaction(tx)) return "INTERNAL_TRANSFER";
  const category = normalizeCategory(tx.category);
  const name = (tx.merchantName ?? tx.name ?? "").toLowerCase();
  const kind = accountKind({
    type: tx.accountType ?? undefined,
    subtype: tx.accountSubtype ?? undefined,
  });
  if (kind === "investment" || kind === "savings") {
    return "INTERNAL_TRANSFER";
  }
  if (transferHintPattern.test(category) || transferHintPattern.test(name)) {
    return "INTERNAL_TRANSFER";
  }
  return "REGULAR";
};

export const accountKind = (account?: {
  type?: string | null;
  subtype?: string | null;
}) => {
  const type = normalizeAccountType(account?.type);
  const subtype = normalizeAccountType(account?.subtype);
  if (
    type.includes("investment") ||
    type.includes("brokerage") ||
    type.includes("retirement") ||
    subtype.includes("ira") ||
    subtype.includes("401k") ||
    subtype.includes("403b") ||
    subtype.includes("cd")
  ) {
    return "investment";
  }
  if (subtype.includes("savings") || type.includes("savings")) {
    return "savings";
  }
  if (type.includes("credit") || type.includes("loan")) {
    return "debt";
  }
  return "other";
};

type InternalTransferMatch = {
  internalIds: Set<string>;
  outflowToDestination: Map<string, string>;
  outflowToPeer: Map<string, string>;
};

export const detectInternalTransfers = (
  transactions: Array<{
    id: string;
    amount: number;
    date: Date;
    accountId: string;
    category?: string | null;
    name?: string | null;
    merchantName?: string | null;
    transactionType?: string | null;
  }>,
  accountMap: Map<string, { type?: string | null; subtype?: string | null }>
): InternalTransferMatch => {
  const internalIds = new Set<string>();
  const outflowToDestination = new Map<string, string>();
  const outflowToPeer = new Map<string, string>();
  const used = new Set<string>();

  const candidates = transactions.map((tx) => {
    const category = normalizeCategory(tx.category);
    const name = (tx.merchantName ?? tx.name ?? "").toLowerCase();
    const acct = accountMap.get(tx.accountId);
    const kind = accountKind(acct);
    const isCandidate =
      tx.transactionType === "INTERNAL_TRANSFER" ||
      transferPattern.test(category) ||
      transferPattern.test(name) ||
      transferHintPattern.test(category) ||
      transferHintPattern.test(name) ||
      kind === "investment" ||
      kind === "savings";
    return { ...tx, isCandidate };
  });

  const inflows = candidates.filter((tx) => tx.amount < 0);
  const outflows = candidates.filter((tx) => tx.amount > 0);

  const windowDays = 3;
  const maxDelta = 1.0;

  outflows.forEach((outflow) => {
    if (used.has(outflow.id)) return;
    const target = inflows
      .filter((inflow) => {
        if (used.has(inflow.id)) return false;
        if (inflow.accountId === outflow.accountId) return false;
        const amountMatch =
          Math.abs(Math.abs(inflow.amount) - Math.abs(outflow.amount)) <=
          maxDelta;
        if (!amountMatch) return false;
        const dayDiff =
          Math.abs(inflow.date.getTime() - outflow.date.getTime()) / 86400000;
        if (dayDiff > windowDays) return false;
        return outflow.isCandidate || inflow.isCandidate;
      })
      .sort(
        (a, b) =>
          Math.abs(a.date.getTime() - outflow.date.getTime()) -
          Math.abs(b.date.getTime() - outflow.date.getTime())
      )[0];

    if (!target) return;

    internalIds.add(outflow.id);
    internalIds.add(target.id);
    used.add(outflow.id);
    used.add(target.id);
    outflowToDestination.set(outflow.id, target.accountId);
    outflowToPeer.set(outflow.id, target.id);
  });

  return { internalIds, outflowToDestination, outflowToPeer };
};
