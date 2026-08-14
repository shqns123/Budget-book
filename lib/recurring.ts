import type { RecurringExpenseTemplate } from "@/lib/ledger";

export const RECURRING_STORAGE_KEY = "ledger-recurring-expenses";

export function readCustomRecurringExpenses(): RecurringExpenseTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(RECURRING_STORAGE_KEY) ?? "[]",
    );
    const items = Array.isArray(saved)
      ? saved.filter(
          (item): item is RecurringExpenseTemplate =>
            typeof item?.id === "string" &&
            typeof item?.name === "string" &&
            typeof item?.accountId === "string" &&
            Number.isFinite(item?.amount) &&
            Number.isFinite(item?.day),
        )
      : [];
    return items;
  } catch {
    return [];
  }
}

export function saveCustomRecurringExpenses(items: RecurringExpenseTemplate[]) {
  window.localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(items));
}
