/**
 * Ledger model and pure calculations, ported from the web app (lib/ledger.ts).
 * Data shapes match what the NAS server stores so web and app share one ledger.
 */
import { randomUUID } from "expo-crypto";

export const newId = () => randomUUID();

export type AccountKind = "bank" | "card" | "loan" | "savings" | "cash";

export type Account = {
  id: string;
  code: string;
  name: string;
  kind: string;
  type: AccountKind;
  paymentDay?: number;
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

export type TransactionType = "income" | "expense" | "transfer";

export type Transaction = {
  id: string;
  accountId: string;
  toAccountId?: string;
  name: string;
  category: string;
  minorCategory?: string;
  amount: number;
  /** Stored as YYYY.MM.DD */
  date: string;
  type: TransactionType;
  fixed?: boolean;
  memo?: string;
  /**
   * On a transfer recorded together with an expense ("자금 이동 같이 기록"): that expense's id.
   * It counts in balances but is hidden from transaction lists; the expense shows a mark instead,
   * and editing or deleting the expense updates or removes it. The web app does the same.
   */
  linkedTo?: string;
};

/** Transactions as lists show them: without transfers recorded together with an expense. */
export const listed = (items: Transaction[]) => items.filter((t) => !t.linkedTo);

/** The transfer recorded together with an expense, if any. */
export const linkedTransfer = (items: Transaction[], expenseId: string) =>
  items.find((t) => t.linkedTo === expenseId);

export type RecurringTemplate = {
  id: string;
  name: string;
  category: string;
  minorCategory: string;
  accountId: string;
  amount: number;
  day: number;
  type?: TransactionType;
  toAccountId?: string;
};

export type MonthlyBudget = { accountId: string; amount: number };

/** The raw settings document, edited by the settings screen (web shape). */
export type AccountSetting = {
  id: string;
  code: string;
  classification: "자산" | "단기부채" | "장기부채";
  major: string;
  minor: string;
  name: string;
  balance: number;
  memo: string;
  kind: AccountKind;
  paymentDay?: number;
  hidden?: boolean;
};

export type CategorySetting = {
  major: string;
  minor: string;
  fixed: boolean;
  transactionType: "income" | "expense";
};

export type SharedSettings = {
  accounts: AccountSetting[];
  categories: CategorySetting[];
  startYear: number;
  fiscalMonth: number;
};

export const emptySettings = (): SharedSettings => ({
  accounts: [],
  categories: [],
  startYear: new Date().getFullYear(),
  fiscalMonth: 1,
});

type StoredAccount = Partial<Omit<AccountSetting, "classification">> & {
  id: string;
  name: string;
  accountCode?: string;
  type?: AccountKind;
  majorCategory?: string;
  minorCategory?: string;
  openingBalance?: number;
  isHidden?: boolean;
  classification?: string;
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

/** Normalize the stored settings into accounts and categories (web: hydrateLedgerSettings). */
export function normalizeSettings(value: unknown) {
  const settings = (value ?? {}) as {
    accounts?: StoredAccount[];
    categories?: StoredCategory[];
  };
  const accounts: Account[] = (settings.accounts ?? []).map((account) => {
    const classification = account.classification;
    const normalized: Account["classification"] =
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
      type: account.type ?? (account.kind as AccountKind) ?? "bank",
      paymentDay: account.paymentDay,
      classification: normalized,
      majorCategory: account.majorCategory ?? account.major ?? "",
      minorCategory: account.minorCategory ?? account.minor ?? "",
      openingBalance: Number(account.openingBalance ?? account.balance ?? 0),
      memo: account.memo,
      hidden: account.hidden ?? account.isHidden,
    };
  });
  const categories: LedgerCategory[] = (settings.categories ?? []).map(
    (category) => ({
      majorCategory: category.majorCategory ?? category.major ?? "",
      minorCategory: category.minorCategory ?? category.minor ?? "",
      fixed: category.fixed ?? category.isFixed ?? false,
      transactionType: category.transactionType ?? "expense",
    }),
  );
  return { accounts, categories };
}

export function inferCategoryTransactionType(
  majorCategory: string,
  minorCategory: string,
  transactions: Transaction[],
): "income" | "expense" {
  const comparable = transactions.filter(
    (t) => t.type !== "transfer" && t.category === majorCategory,
  );
  const exact = comparable.filter((t) => t.minorCategory === minorCategory);
  const candidates = exact.length ? exact : comparable;
  const income = candidates.filter((t) => t.type === "income").length;
  const expense = candidates.filter((t) => t.type === "expense").length;
  return income > expense ? "income" : "expense";
}

/** Fill in transactionType on categories saved before it existed. */
export function migrateSettings(settings: SharedSettings, records: Transaction[]) {
  const needsMigration = settings.categories.some((c) => !c.transactionType);
  if (!needsMigration) return { settings, migrated: false };
  return {
    migrated: true,
    settings: {
      ...settings,
      categories: settings.categories.map((category) => ({
        ...category,
        transactionType:
          category.transactionType ??
          inferCategoryTransactionType(category.major, category.minor, records),
      })),
    },
  };
}

const normalizeDate = (value: string) => {
  const [year, month, day] = value.replaceAll(".", "-").split("-");
  if (!year || !month || !day) return value;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

export function calculateAccountBalances(
  details: Account[],
  records: Transaction[],
  cutoff?: string,
) {
  const amounts = new Map(details.map((a) => [a.id, a.openingBalance]));
  const byId = new Map(details.map((a) => [a.id, a]));
  const apply = (accountId: string, assetChange: number) => {
    const account = byId.get(accountId);
    const change = account?.classification === "asset" ? assetChange : -assetChange;
    amounts.set(accountId, (amounts.get(accountId) ?? 0) + change);
  };
  records
    .filter((item) => !cutoff || normalizeDate(item.date) <= cutoff)
    .forEach((item) => {
      if (item.type === "income") apply(item.accountId, item.amount);
      if (item.type === "expense") apply(item.accountId, -Math.abs(item.amount));
      if (item.type === "transfer") {
        apply(item.accountId, -Math.abs(item.amount));
        if (item.toAccountId) apply(item.toAccountId, Math.abs(item.amount));
      }
    });
  return amounts;
}

export function categoryOptions(
  categories: LedgerCategory[],
  type: "income" | "expense",
) {
  return categories
    .filter((c) => c.transactionType === type)
    .reduce<Record<string, string[]>>((result, c) => {
      const options = result[c.majorCategory] ?? [];
      if (!options.includes(c.minorCategory)) options.push(c.minorCategory);
      result[c.majorCategory] = options;
      return result;
    }, {});
}

export const isDebtAccount = (accounts: Account[], id: string) =>
  ["card", "loan"].includes(accounts.find((a) => a.id === id)?.type ?? "");

/** Fixed costs are the expenses marked fixed: the ones registered from the 반복 tab. */

/**
 * Expenses recorded before registering from the 반복 tab marked them fixed: unmarked expenses with
 * the same 내용, 대분류 · 소분류 and 출금 통장 as an expense recurring item.
 */
export function unmarkedRecurringExpenses(transactions: Transaction[], recurring: RecurringTemplate[]) {
  const key = (name: string, category: string, minor: string | undefined, accountId: string) =>
    [name.trim(), category, minor?.trim() ?? "", accountId].join(" ");
  const keys = new Set(
    recurring
      .filter((r) => (r.type ?? "expense") === "expense")
      .map((r) => key(r.name, r.category, r.minorCategory, r.accountId)),
  );
  return transactions.filter(
    (t) => t.type === "expense" && !t.fixed && keys.has(key(t.name, t.category, t.minorCategory, t.accountId)),
  );
}
export function totals(items: Transaction[]) {
  const income = items
    .filter((i) => i.type === "income")
    .reduce((sum, i) => sum + i.amount, 0);
  const expense = items
    .filter((i) => i.type === "expense")
    .reduce((sum, i) => sum + Math.abs(i.amount), 0);
  const fixedExpense = items
    .filter((i) => i.type === "expense" && i.fixed)
    .reduce((sum, i) => sum + Math.abs(i.amount), 0);
  return { income, expense, fixedExpense, variableExpense: expense - fixedExpense };
}

export function withinSelected(items: Transaction[], selected: string[]) {
  if (!selected.length) return items;
  return items.filter(
    (i) =>
      selected.includes(i.accountId) ||
      (i.toAccountId ? selected.includes(i.toAccountId) : false),
  );
}

/** "2026-08" → records whose YYYY.MM.DD date falls in that month. */
export const inMonth = (records: Transaction[], month: string) =>
  records.filter((r) => r.date.replaceAll(".", "-").startsWith(month));

export const formatNumber = (value: number | string) => {
  const raw = String(value);
  if (!raw || raw === "-") return raw;
  const amount = Number(raw.replaceAll(",", ""));
  return Number.isFinite(amount) ? amount.toLocaleString("ko-KR") : "";
};

export const parseNumberInput = (value: string) => {
  const sign = value.trimStart().startsWith("-") ? "-" : "";
  return `${sign}${value.replace(/[^0-9]/g, "")}`;
};

export const won = (value: number) => `${formatNumber(Math.abs(value))}원`;
export const signedWon = (value: number) => `${value < 0 ? "−" : ""}${won(value)}`;

export const typeLabel = (type: TransactionType) =>
  type === "income" ? "수입" : type === "transfer" ? "이동" : "지출";

export const accountName = (accounts: Account[], id?: string) =>
  accounts.find((a) => a.id === id)?.name ?? "";
