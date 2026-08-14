export type SavingsGoal = { id: string; name: string; targetAmount: number };
export type SavingsEntry = {
  id: string;
  goalId: string;
  date: string;
  amount: number;
  accountId: string;
  memo: string;
  monthlyMonth?: string;
  monthlyPlanId?: string;
};
export type MonthlySavingsPlan = {
  id: string;
  goalId: string;
  month: string;
  name: string;
  amount: number;
  accountId: string;
};
export type MonthlySavingsMonth = {
  id: string;
  goalId: string;
  month: string;
};
export type SavingsPlanItem = {
  id: string;
  name: string;
  amount: number;
  goalId: string;
  accountId?: string;
};

const GOALS_KEY = "ledger-savings-goals";
const ENTRIES_KEY = "ledger-savings-entries";
const PLAN_KEY = "ledger-savings-home-plan";

export const defaultSavingsGoals: SavingsGoal[] = [
  { id: "home", name: "내 집 마련", targetAmount: 726600000 },
];
export const defaultSavingsPlan: SavingsPlanItem[] = [
  { id: "contract", goalId: "home", name: "계약금", amount: -5000000 },
  { id: "balance", goalId: "home", name: "잔금", amount: -38760000 },
  { id: "premium", goalId: "home", name: "프리미엄 잔금", amount: -2200000 },
  { id: "brokerage", goalId: "home", name: "중개수수료", amount: -2200000 },
  { id: "moving", goalId: "home", name: "보관 이사비", amount: 5000000 },
  { id: "tax", goalId: "home", name: "취득세", amount: 15000000 },
  {
    id: "interior",
    goalId: "home",
    name: "인테리어 및 여러가지",
    amount: 40000000,
  },
];

export function readSavingsGoals(): SavingsGoal[] {
  if (typeof window === "undefined") return defaultSavingsGoals;
  try {
    const saved = JSON.parse(window.localStorage.getItem(GOALS_KEY) ?? "null");
    return Array.isArray(saved) ? saved : defaultSavingsGoals;
  } catch {
    return defaultSavingsGoals;
  }
}

export function saveSavingsGoals(items: SavingsGoal[]) {
  window.localStorage.setItem(GOALS_KEY, JSON.stringify(items));
}

export function readSavingsEntries(): SavingsEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(ENTRIES_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveSavingsEntries(items: SavingsEntry[]) {
  window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(items));
}

export function readSavingsPlan(): SavingsPlanItem[] {
  if (typeof window === "undefined") return defaultSavingsPlan;
  try {
    const saved = JSON.parse(window.localStorage.getItem(PLAN_KEY) ?? "null");
    return Array.isArray(saved)
      ? saved.map((item) => ({ ...item, goalId: item.goalId ?? "home" }))
      : defaultSavingsPlan;
  } catch {
    return defaultSavingsPlan;
  }
}

export function saveSavingsPlan(items: SavingsPlanItem[]) {
  window.localStorage.setItem(PLAN_KEY, JSON.stringify(items));
}
