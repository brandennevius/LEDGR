export type ApiError = {
  message: string;
  code?: string;
};

export type TransactionType = 'INCOME' | 'REGULAR' | 'INTERNAL_TRANSFER';

export type TransactionSplit = {
  id: string;
  category: string;
  amount: number;
  note?: string | null;
};

export type Transaction = {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  transactionType?: TransactionType;
  needsReview?: boolean;
  splits?: TransactionSplit[];
};

export type Category = {
  name: string;
  spend: number;
  budget?: number | null;
  essential?: boolean;
};

export type Goal = {
  id: string;
  name: string;
  type: string;
  target: number;
  current: number;
  status?: string;
};
