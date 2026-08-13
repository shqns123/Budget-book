import type { RecurringExpenseTemplate } from "@/lib/ledger";
import sheet26Recurring from "@/data/sheet26-recurring.json";

export const RECURRING_STORAGE_KEY = "ledger-recurring-expenses";
const RECURRING_MIGRATION_KEY = "ledger-recurring-expenses-sheet26-v1";
export const sheet26RecurringTemplates =
  sheet26Recurring as RecurringExpenseTemplate[];

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
    if (window.localStorage.getItem(RECURRING_MIGRATION_KEY)) return items;
    const merged = [
      ...sheet26RecurringTemplates,
      ...items.filter(
        (item) =>
          !sheet26RecurringTemplates.some((seed) => seed.id === item.id),
      ),
    ];
    window.localStorage.setItem(RECURRING_MIGRATION_KEY, "true");
    window.localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return sheet26RecurringTemplates;
  }
}

export function saveCustomRecurringExpenses(items: RecurringExpenseTemplate[]) {
  window.localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(items));
}
