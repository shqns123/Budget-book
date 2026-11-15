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
export type MonthlySavingsMonth = { id: string; goalId: string; month: string };
export type SavingsPlanItem = {
  id: string;
  name: string;
  amount: number;
  goalId: string;
  accountId?: string;
};
