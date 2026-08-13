import importedLedger from "@/data/imported-ledger.json";

export type Account = {
  id: string;
  name: string;
  kind: string;
  type: "bank" | "card" | "loan" | "savings" | "cash";
  paymentDay?: number;
};

export type Transaction = {
  id: string;
  accountId: string;
  toAccountId?: string;
  name: string;
  category: string;
  minorCategory?: string;
  amount: number;
  date: string;
  type: "income" | "expense" | "transfer";
  fixed?: boolean;
  memo?: string;
};

export type RecurringExpenseTemplate = {
  id: string;
  name: string;
  category: string;
  minorCategory: string;
  accountId: string;
  amount: number;
  day: number;
  type?: "income" | "expense" | "transfer";
  toAccountId?: string;
};

export const importedSettings = importedLedger.settings;

export const accounts: Account[] = importedLedger.accounts.map((account) => ({
  id: account.id,
  name: account.name,
  kind: account.minorCategory,
  type: account.type as Account["type"],
  paymentDay: account.paymentDay ?? undefined,
}));

export const initialTransactions: Transaction[] = importedLedger.transactions
  .map((transaction) => ({
    id: transaction.id,
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId ?? undefined,
    name: transaction.memo,
    category: transaction.category,
    minorCategory: transaction.minorCategory ?? undefined,
    amount:
      transaction.type === "income" ? transaction.amount : -transaction.amount,
    date: transaction.date.replaceAll("-", "."),
    type: transaction.type as Transaction["type"],
    fixed: transaction.isFixed,
  }))
  .sort((left, right) => right.date.localeCompare(left.date));

const recurringByName = new Map<string, RecurringExpenseTemplate>();
for (const transaction of initialTransactions) {
  if (transaction.type !== "expense" || !transaction.minorCategory) continue;
  const key = `${transaction.name}|${transaction.accountId}`;
  if (recurringByName.has(key)) continue;
  recurringByName.set(key, {
    id: transaction.id,
    name: transaction.name,
    category: transaction.category,
    minorCategory: transaction.minorCategory,
    accountId: transaction.accountId,
    amount: Math.abs(transaction.amount),
    day: Number(transaction.date.slice(-2)),
  });
}

export const recurringExpenseTemplates = [...recurringByName.values()].slice(
  0,
  12,
);

export const formatNumber = (value: number | string) => {
  const raw = String(value);
  if (!raw || raw === "-") return raw;
  const amount = Number(raw.replaceAll(",", ""));
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("ko-KR").format(amount)
    : "";
};

export const parseNumberInput = (value: string) => {
  const sign = value.trimStart().startsWith("-") ? "-" : "";
  return `${sign}${value.replace(/[^0-9]/g, "")}`;
};

export const won = (value: number) => `${formatNumber(Math.abs(value))}원`;
