export type Account = {
  id: string;
  name: string;
  kind: string;
  type: "bank" | "card" | "loan" | "savings" | "cash";
  paymentDay?: number;
};

export type AccountDetails = Account & {
  code: string;
  classification: "asset" | "short_liability" | "long_liability";
  majorCategory: string;
  minorCategory: string;
  openingBalance: number;
  memo?: string;
  hidden?: boolean;
};

export type LedgerCategory = {
  majorCategory: string;
  minorCategory: string;
  fixed: boolean;
  transactionType: "income" | "expense";
};

type StoredAccount = {
  id: string;
  code?: string;
  accountCode?: string;
  name: string;
  kind?: string;
  type?: Account["type"];
  classification?: string;
  major?: string;
  majorCategory?: string;
  minor?: string;
  minorCategory?: string;
  balance?: number;
  openingBalance?: number;
  memo?: string;
  paymentDay?: number;
  hidden?: boolean;
  isHidden?: boolean;
};

type StoredCategory = {
  major?: string;
  majorCategory?: string;
  minor?: string;
  minorCategory?: string;
  fixed?: boolean;
  isFixed?: boolean;
  transactionType?: "income" | "expense";
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

export function calculateAccountBalances(
  details: AccountDetails[],
  records: Transaction[],
  cutoff?: string,
) {
  const amounts = new Map(
    details.map((account) => [account.id, account.openingBalance]),
  );
  const accountsById = new Map(
    details.map((account) => [account.id, account]),
  );
  const applyChange = (accountId: string, assetChange: number) => {
    const account = accountsById.get(accountId);
    const change =
      account?.classification === "asset" ? assetChange : -assetChange;
    amounts.set(accountId, (amounts.get(accountId) ?? 0) + change);
  };

  records
    .filter(
      (item) =>
        !cutoff || item.date.replaceAll(".", "-") <= cutoff,
    )
    .forEach((item) => {
      if (item.type === "income") applyChange(item.accountId, item.amount);
      if (item.type === "expense")
        applyChange(item.accountId, -Math.abs(item.amount));
      if (item.type === "transfer") {
        applyChange(item.accountId, -Math.abs(item.amount));
        if (item.toAccountId)
          applyChange(item.toAccountId, Math.abs(item.amount));
      }
    });

  return amounts;
}

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

// Runtime data is loaded from SQLite through the shared-state API.
// These empty fallbacks keep first render safe before that request completes.
export const accounts: Account[] = [];
export const accountDetails: AccountDetails[] = [];
export const categories: LedgerCategory[] = [];
export const initialTransactions: Transaction[] = [];
export const recurringExpenseTemplates: RecurringExpenseTemplate[] = [];

export function inferCategoryTransactionType(
  majorCategory: string,
  minorCategory: string,
  transactions: Transaction[],
): "income" | "expense" {
  const comparable = transactions.filter(
    (transaction) =>
      transaction.type !== "transfer" &&
      transaction.category === majorCategory,
  );
  const exact = comparable.filter(
    (transaction) => transaction.minorCategory === minorCategory,
  );
  const candidates = exact.length ? exact : comparable;
  const incomeCount = candidates.filter(
    (transaction) => transaction.type === "income",
  ).length;
  const expenseCount = candidates.filter(
    (transaction) => transaction.type === "expense",
  ).length;
  return incomeCount > expenseCount ? "income" : "expense";
}

export function hydrateLedgerSettings(value: unknown) {
  const settings = value as {
    accounts?: StoredAccount[];
    categories?: StoredCategory[];
  };
  const normalizedAccounts = (settings.accounts ?? []).map((account) => {
    const classification = account.classification;
    const normalizedClassification =
      classification === "short_liability" || classification === "단기부채"
        ? "short_liability"
        : classification === "long_liability" || classification === "장기부채"
          ? "long_liability"
          : "asset";
    return {
      id: account.id,
      code: account.code ?? account.accountCode ?? "",
      name: account.name,
      kind: account.kind ?? account.type ?? "bank",
      type: account.type ?? (account.kind as Account["type"]) ?? "bank",
      paymentDay: account.paymentDay,
      classification: normalizedClassification,
      majorCategory: account.majorCategory ?? account.major ?? "",
      minorCategory: account.minorCategory ?? account.minor ?? "",
      openingBalance: Number(account.openingBalance ?? account.balance ?? 0),
      memo: account.memo,
      hidden: account.hidden ?? account.isHidden,
    } satisfies AccountDetails;
  });
  accounts.splice(0, accounts.length, ...normalizedAccounts);
  accountDetails.splice(0, accountDetails.length, ...normalizedAccounts);
  categories.splice(
    0,
    categories.length,
    ...(settings.categories ?? []).map((category) => ({
      majorCategory: category.majorCategory ?? category.major ?? "",
      minorCategory: category.minorCategory ?? category.minor ?? "",
      fixed: category.fixed ?? category.isFixed ?? false,
      transactionType: category.transactionType ?? "expense",
    })),
  );
}

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
