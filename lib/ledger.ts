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
  /**
   * On a transfer the native app recorded together with an expense ("자금 이동 같이 기록"):
   * that expense's id. It counts in balances but is hidden from transaction lists; the expense
   * shows a mark instead, and editing or deleting the expense updates or removes it.
   */
  linkedTo?: string;
  /** The 반복 항목 the native app registered this record from (일괄 등록 or a payment notice). */
  recurringId?: string;
};

export function calculateAccountBalances(
  details: AccountDetails[],
  records: Transaction[],
  cutoff?: string,
) {
  const normalizeDate = (value: string) => {
    const [year, month, day] = value.replaceAll(".", "-").split("-");
    if (!year || !month || !day) return value;
    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };
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
        !cutoff || normalizeDate(item.date) <= cutoff,
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

const ACCOUNT_GROUPS = ["자산", "단기부채", "장기부채"];

/**
 * On screen, 단기부채 reads 미결제 금액 (card balances not yet paid). Only the label changes: the
 * stored value stays 단기부채, so existing ledgers, the app and the rules that read it still agree.
 */
export const classificationLabel = (classification: string) =>
  classification === "단기부채" ? "미결제 금액" : classification;

/** A stored 대분류 for display: the imported 「🏦단기부채」 reads 「🏦미결제 금액」. */
export const majorLabel = (major: string) =>
  major.replace("단기부채", "미결제 금액");

/**
 * Moves an account one place up (-1) or down (+1) within its group (자산 · 단기부채 · 장기부채).
 * The stored list is the order every account list follows (거래내역, 통장별 지출, pickers), so
 * it is also regrouped to read 자산 → 단기부채 → 장기부채, as the settings page shows it.
 */
export function moveAccount<T extends { id: string; classification: string }>(
  accounts: T[],
  id: string,
  step: -1 | 1,
): T[] {
  const account = accounts.find((row) => row.id === id);
  if (!account) return accounts;
  const group = accounts.filter((row) => row.classification === account.classification);
  const target = group[group.findIndex((row) => row.id === id) + step];
  return target ? moveAccountTo(accounts, id, target.id) : accounts;
}

export function moveAccountTo<T extends { id: string; classification: string }>(
  accounts: T[],
  id: string,
  targetId: string,
): T[] {
  const groups = ACCOUNT_GROUPS.map((group) =>
    accounts.filter((account) => account.classification === group),
  );
  const rest = accounts.filter(
    (account) => !ACCOUNT_GROUPS.includes(account.classification),
  );
  const group = groups.find((rows) => rows.some((account) => account.id === id));
  if (!group) return accounts;
  const from = group.findIndex((account) => account.id === id);
  const to = group.findIndex((account) => account.id === targetId);
  if (to < 0 || to === from) return accounts;
  const [account] = group.splice(from, 1);
  group.splice(to, 0, account);
  return [...groups.flat(), ...rest];
}

/** Move a group or one of its rows to the other type, without creating duplicate minors. */
export function moveCategoryType<T extends {
  major: string;
  minor: string;
  transactionType: "income" | "expense";
}>(
  categories: T[],
  type: T["transactionType"],
  major: string,
  nextType: T["transactionType"],
  rowIndex?: number,
): T[] {
  if (type === nextType) return categories;
  const matches = (row: T, index: number) =>
    row.transactionType === type && row.major === major && (rowIndex === undefined || rowIndex === index);
  const moving = categories.filter(matches);
  const destination = new Set(
    categories
      .filter((row) => row.transactionType === nextType && row.major === major)
      .map((row) => row.minor?.trim()),
  );
  if (!moving.length || moving.some((row) => destination.has(row.minor?.trim()))) return categories;
  return categories.map((row, index) =>
    matches(row, index) ? { ...row, transactionType: nextType } : row,
  );
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
