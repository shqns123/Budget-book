export type MonthlyBudget = { accountId: string; amount: number };

export const BUDGET_STORAGE_KEY = "ledger-monthly-budgets";
export const DEFAULT_ACCOUNT_STORAGE_KEY = "ledger-default-accounts";

export function readMonthlyBudgets(): MonthlyBudget[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(BUDGET_STORAGE_KEY) ?? "[]",
    ) as MonthlyBudget[];
    return saved.filter(
      (item) =>
        item.accountId && Number.isFinite(item.amount) && item.amount > 0,
    );
  } catch {
    return [];
  }
}

export function saveMonthlyBudgets(items: MonthlyBudget[]) {
  window.localStorage.setItem(
    BUDGET_STORAGE_KEY,
    JSON.stringify(items.filter((item) => item.accountId && item.amount > 0)),
  );
}

export function readDefaultAccountIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(DEFAULT_ACCOUNT_STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveDefaultAccountIds(ids: string[]) {
  window.localStorage.setItem(DEFAULT_ACCOUNT_STORAGE_KEY, JSON.stringify(ids));
}
