export const asOfDate = new Date("2026-02-02T12:00:00-08:00");

export const mockClient = {
  id: "client-001",
  name: "Alex Rivera",
};

export const mockAccounts = [
  { id: "acc-checking", name: "Checking", type: "checking", balance: 2480 },
  { id: "acc-savings", name: "Savings", type: "savings", balance: 1340 },
  { id: "acc-cd", name: "CD Savings", type: "investment", balance: 5200 },
  { id: "acc-card", name: "Credit Card", type: "credit", balance: -3200 },
];

export const mockGoals = [
  {
    id: "goal-emergency",
    name: "Emergency fund",
    type: "SAVINGS",
    current: 4200,
    target: 8000,
  },
  {
    id: "goal-debt",
    name: "Debt payoff",
    type: "DEBT",
    current: 3200,
    target: 6200,
  },
  {
    id: "goal-buffer",
    name: "Buffer days",
    type: "BUFFER_DAYS",
    current: 12.4,
    target: 18,
  },
];

export type Transaction = {
  id: string;
  accountId: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
};

const day = (offset: number, hour = 12) => {
  const date = new Date(asOfDate);
  date.setDate(asOfDate.getDate() - offset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const mockTransactions: Transaction[] = [
  { id: "tx-100", accountId: "acc-checking", merchant: "Helios Payroll", category: "Income", amount: 2560, date: day(1, 9) },
  { id: "tx-101", accountId: "acc-checking", merchant: "Cedar Rent", category: "Housing", amount: -1680, date: day(2, 8) },
  { id: "tx-102", accountId: "acc-checking", merchant: "Sunset Grocer", category: "Groceries", amount: -84, date: day(2, 18) },
  { id: "tx-103", accountId: "acc-checking", merchant: "Night Owl Diner", category: "Dining", amount: -42, date: day(3, 22) },
  { id: "tx-103b", accountId: "acc-checking", merchant: "CD Deposit", category: "Transfer", amount: -1000, date: day(3, 11) },
  { id: "tx-103c", accountId: "acc-cd", merchant: "CD Deposit", category: "Transfer", amount: 1000, date: day(3, 11) },
  { id: "tx-104", accountId: "acc-checking", merchant: "Bluewave Transit", category: "Transport", amount: -18, date: day(3, 9) },
  { id: "tx-105", accountId: "acc-checking", merchant: "Streamly", category: "Subscriptions", amount: -14, date: day(4, 7) },
  { id: "tx-106", accountId: "acc-checking", merchant: "Volt Energy", category: "Utilities", amount: -112, date: day(4, 13) },
  { id: "tx-107", accountId: "acc-checking", merchant: "Market Hall", category: "Groceries", amount: -62, date: day(5, 17) },
  { id: "tx-108", accountId: "acc-checking", merchant: "LEDGR Cafe", category: "Dining", amount: -38, date: day(5, 21) },
  { id: "tx-109", accountId: "acc-checking", merchant: "Atlas Fitness", category: "Health", amount: -64, date: day(6, 6) },
  { id: "tx-110", accountId: "acc-checking", merchant: "Skyline Fuel", category: "Transport", amount: -42, date: day(6, 8) },
  { id: "tx-111", accountId: "acc-checking", merchant: "Market Hall", category: "Groceries", amount: -58, date: day(7, 18) },
  { id: "tx-112", accountId: "acc-checking", merchant: "Cloudbox", category: "Subscriptions", amount: -26, date: day(7, 7) },
  { id: "tx-113", accountId: "acc-checking", merchant: "City Utilities", category: "Utilities", amount: -92, date: day(8, 10) },
  { id: "tx-114", accountId: "acc-checking", merchant: "Glow Salon", category: "Personal Care", amount: -48, date: day(8, 16) },
  { id: "tx-115", accountId: "acc-checking", merchant: "Moonlight Kitchen", category: "Dining", amount: -52, date: day(9, 22) },
  { id: "tx-116", accountId: "acc-checking", merchant: "Greenway Market", category: "Groceries", amount: -76, date: day(9, 12) },
  { id: "tx-117", accountId: "acc-checking", merchant: "Loop Ride", category: "Transport", amount: -14, date: day(10, 9) },
  { id: "tx-118", accountId: "acc-checking", merchant: "Trail Outfitters", category: "Shopping", amount: -96, date: day(10, 15) },
  { id: "tx-119", accountId: "acc-checking", merchant: "Crest Cinema", category: "Entertainment", amount: -32, date: day(11, 20) },
  { id: "tx-120", accountId: "acc-checking", merchant: "Helios Payroll", category: "Income", amount: 2480, date: day(15, 9) },
  { id: "tx-121", accountId: "acc-checking", merchant: "Cedar Rent", category: "Housing", amount: -1680, date: day(16, 8) },
  { id: "tx-122", accountId: "acc-checking", merchant: "Sunset Grocer", category: "Groceries", amount: -98, date: day(16, 18) },
  { id: "tx-123", accountId: "acc-checking", merchant: "Golden Noodle", category: "Dining", amount: -58, date: day(16, 22) },
  { id: "tx-124", accountId: "acc-checking", merchant: "Streamly", category: "Subscriptions", amount: -14, date: day(17, 7) },
  { id: "tx-125", accountId: "acc-checking", merchant: "Cloudbox", category: "Subscriptions", amount: -26, date: day(17, 7) },
  { id: "tx-126", accountId: "acc-checking", merchant: "QuickRide", category: "Transport", amount: -22, date: day(17, 9) },
  { id: "tx-127", accountId: "acc-checking", merchant: "Market Hall", category: "Groceries", amount: -72, date: day(18, 17) },
  { id: "tx-128", accountId: "acc-checking", merchant: "Night Owl Diner", category: "Dining", amount: -64, date: day(18, 23) },
  { id: "tx-129", accountId: "acc-checking", merchant: "Summit Outfitters", category: "Shopping", amount: -122, date: day(18, 14) },
  { id: "tx-130", accountId: "acc-checking", merchant: "Voltage Energy", category: "Utilities", amount: -110, date: day(19, 12) },
  { id: "tx-131", accountId: "acc-checking", merchant: "Orbit Mobile", category: "Subscriptions", amount: -54, date: day(19, 9) },
  { id: "tx-132", accountId: "acc-checking", merchant: "Sunset Grocer", category: "Groceries", amount: -64, date: day(20, 18) },
  { id: "tx-133", accountId: "acc-checking", merchant: "LEDGR Cafe", category: "Dining", amount: -46, date: day(20, 21) },
  { id: "tx-134", accountId: "acc-checking", merchant: "Metro Transit", category: "Transport", amount: -18, date: day(21, 9) },
  { id: "tx-135", accountId: "acc-checking", merchant: "Vista Market", category: "Groceries", amount: -80, date: day(21, 16) },
  { id: "tx-136", accountId: "acc-checking", merchant: "Atlas Fitness", category: "Health", amount: -64, date: day(22, 6) },
  { id: "tx-137", accountId: "acc-checking", merchant: "Skyline Fuel", category: "Transport", amount: -44, date: day(22, 8) },
  { id: "tx-138", accountId: "acc-checking", merchant: "Crest Cinema", category: "Entertainment", amount: -28, date: day(23, 20) },
  { id: "tx-139", accountId: "acc-checking", merchant: "Moonlight Kitchen", category: "Dining", amount: -68, date: day(23, 22) },
  { id: "tx-140", accountId: "acc-checking", merchant: "Greenway Market", category: "Groceries", amount: -74, date: day(24, 12) },
  { id: "tx-141", accountId: "acc-checking", merchant: "Loop Ride", category: "Transport", amount: -16, date: day(24, 9) },
  { id: "tx-142", accountId: "acc-checking", merchant: "Cloudbox", category: "Subscriptions", amount: -26, date: day(25, 7) },
  { id: "tx-143", accountId: "acc-checking", merchant: "Glow Salon", category: "Personal Care", amount: -52, date: day(25, 16) },
  { id: "tx-144", accountId: "acc-checking", merchant: "Trail Outfitters", category: "Shopping", amount: -110, date: day(26, 14) },
  { id: "tx-145", accountId: "acc-checking", merchant: "Atlas Electric", category: "Utilities", amount: -98, date: day(27, 10) },
  { id: "tx-146", accountId: "acc-checking", merchant: "Orbit Mobile", category: "Subscriptions", amount: -54, date: day(27, 9) },
];
