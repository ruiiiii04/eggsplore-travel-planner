export type Expense = {
  id: string;
  trip_id: string;
  paid_by: string | null;
  created_by: string | null;
  title: string;
  amount: number;
  category: string | null;
  created_at: string;
  original_amount?: number | null;
  original_currency?: string;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  settled: boolean;
  created_at: string;
};

export type TripBudget = {
  id: string;
  trip_id: string;
  user_id: string;
  budget_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type SplitType = "evenly" | "amount" | "none";

export type ExpenseCategory =
  | "food"
  | "transport"
  | "stay"
  | "activities"
  | "shopping"
  | "other";

export function validateExpense(title: string, amount: string): string | null {
  if (!title.trim()) return "Enter an expense title.";
  if (!amount.trim() || Number.isNaN(Number(amount)))
    return "Enter a valid amount.";
  if (Number(amount) <= 0) return "Amount must be greater than zero.";
  return null;
}

// Splits amount evenly across members in cents, so rounding remainders are
// distributed one cent at a time instead of lost to floating point error.
export function splitEqually(
  amount: number,
  memberIds: string[],
): Record<string, number> {
  if (memberIds.length === 0) return {};
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / memberIds.length);
  const remainder = cents - base * memberIds.length;
  const result: Record<string, number> = {};
  memberIds.forEach((id, index) => {
    const share = base + (index < remainder ? 1 : 0);
    result[id] = share / 100;
  });
  return result;
}

export function totalSpent(expenses: Pick<Expense, "amount">[]): number {
  return (
    Math.round(expenses.reduce((sum, expense) => sum + expense.amount, 0) * 100) /
    100
  );
}

// Net amount each user still owes, ignoring splits already marked settled.
export function balanceSummary(
  splits: Pick<ExpenseSplit, "user_id" | "amount_owed" | "settled">[],
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const split of splits) {
    if (split.settled) continue;
    balances[split.user_id] = Math.round(
      ((balances[split.user_id] ?? 0) + split.amount_owed) * 100,
    ) / 100;
  }
  return balances;
}

// Static rates for hackathon scope -- all relative to 1 unit = X RM.
// Update manually; not live.
export const CURRENCY_RATES: Record<string, number> = {
  RM: 1,
  USD: 4.4,
  SGD: 3.3,
  EUR: 4.8,
  JPY: 0.03,
};

export function convertToRM(amount: number, currency: string): number {
  const rate = CURRENCY_RATES[currency] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

export function budgetProgress(spent: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}

export function remainingBudget(spent: number, budget: number): number {
  return Math.round((budget - spent) * 100) / 100;
}

// Given an even split, returns each member's share. Given "none", the
// payer covers it alone with no splits created. "amount" splits are
// user-entered directly, so no calculation is needed here.
export function buildSplits(
  splitType: SplitType,
  amount: number,
  payerId: string,
  memberIds: string[],
): Record<string, number> {
  if (splitType === "none") return { [payerId]: amount };
  if (splitType === "evenly") return splitEqually(amount, memberIds);
  return {};
}

// First-time setup should only be forced when the user has neither set a
// budget nor logged any expenses yet for this trip.
export function needsBudgetSetup(
  hasBudget: boolean,
  expenseCount: number,
): boolean {
  return !hasBudget && expenseCount === 0;
}