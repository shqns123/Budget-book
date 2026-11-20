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
  /** The row's stable id (분류 아이디), once the server has given it one. */
  id?: string;
};

/**
 * A 분류 remembered from before (대기함 memory, a model's suggestion) as it is now: by its id when
 * the row still exists (renamed or not), else by its names if they are still a row's names. Gone
 * or renamed without an id: undefined, so the caller fills the 분류 another way.
 */
export function currentCategory(
  ref: { categoryId?: string; category: string; minorCategory: string },
  type: "income" | "expense",
  categories: LedgerCategory[],
): { category: string; minorCategory: string; categoryId?: string } | undefined {
  const byId = ref.categoryId ? categories.find((c) => c.id === ref.categoryId) : undefined;
  const row =
    byId ??
    categories.find(
      (c) =>
        c.transactionType === type &&
        c.majorCategory === ref.category &&
        (!ref.minorCategory || c.minorCategory === ref.minorCategory),
    );
  if (!row) return undefined;
  return {
    category: row.majorCategory,
    minorCategory: ref.minorCategory ? row.minorCategory : "",
    ...(row.id ? { categoryId: row.id } : {}),
  };
}

export type TransactionType = "income" | "expense" | "transfer";

export type Transaction = {
  id: string;
  accountId: string;
  toAccountId?: string;
  name: string;
  category: string;
  minorCategory?: string;
  /** The category row (CategorySetting.id): its current names replace category / minorCategory. */
  categoryId?: string;
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
  /**
   * The 반복 항목 this record was registered from (일괄 등록 or a payment notice), so a month
   * never gets the same 반복 항목 twice.
   */
  recurringId?: string;
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
  /** The category row (CategorySetting.id) it belongs to. */
  categoryId?: string;
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
  /** The 대분류's icon (components/ledger/CategoryIcon), kept on each of its rows. */
  icon?: string;
  /** Stable row id, given by the server: records link to it, so renaming keeps them. */
  id?: string;
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

const ACCOUNT_GROUPS: AccountSetting["classification"][] = ["자산", "단기부채", "장기부채"];

/**
 * On screen, 단기부채 reads 미결제 금액 (card balances not yet paid). Only the label changes: the
 * stored value stays 단기부채, so existing ledgers, the web and the rules that read it still agree.
 */
export const classificationLabel = (classification: AccountSetting["classification"]) =>
  classification === "단기부채" ? "미결제 금액" : classification;

/** A stored 대분류 for display: the imported 「🏦단기부채」 reads 「🏦미결제 금액」. */
export const majorLabel = (major: string) => major.replace("단기부채", "미결제 금액");

/**
 * Moves an account one place up (-1) or down (+1) within its group (자산 · 단기부채 · 장기부채).
 * The stored list is the order every account list follows (거래내역, 통장별 지출, pickers), so
 * it is also regrouped to read 자산 → 단기부채 → 장기부채, as the settings screen shows it.
 */
export function moveAccount(accounts: AccountSetting[], id: string, step: -1 | 1): AccountSetting[] {
  const account = accounts.find((row) => row.id === id);
  if (!account) return accounts;
  const group = accounts.filter((row) => row.classification === account.classification);
  const target = group[group.findIndex((row) => row.id === id) + step];
  return target ? moveAccountTo(accounts, id, target.id) : accounts;
}

export function moveAccountTo(accounts: AccountSetting[], id: string, targetId: string): AccountSetting[] {
  const groups = ACCOUNT_GROUPS.map((group) => accounts.filter((a) => a.classification === group));
  const rest = accounts.filter((a) => !ACCOUNT_GROUPS.includes(a.classification));
  const group = groups.find((rows) => rows.some((a) => a.id === id));
  if (!group) return accounts;
  const from = group.findIndex((a) => a.id === id);
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
  id?: string;
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
      ...(category.id ? { id: category.id } : {}),
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
