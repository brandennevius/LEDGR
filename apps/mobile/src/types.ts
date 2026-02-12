export type TransactionType = 'expense' | 'income' | 'transfer';

export type Split = {
  id: string;
  label: string;
  amount: number;
  categoryId: string;
};

export type Transaction = {
  id: string;
  merchant: string;
  name: string;
  amount: number;
  date: string;
  type: TransactionType;
  categoryId: string;
  account: string;
  notes?: string;
  splits?: Split[];
};

export type Category = {
  id: string;
  name: string;
  group: string;
  color: string;
};

export type CategoryRule = {
  id: string;
  categoryId: string;
  mode: 'exact' | 'partial';
  pattern: string;
};
